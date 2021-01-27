const _ = require('lodash');

const rx = require('./rx');

module.exports = class Acl {
    constructor(acls, context, executors = true, rootAccess = `root-${process.pid}`) {
        const customExecutors = _.isArray(executors);

        this.acls = acls;
        this.context = context;
        this.rootAccess = rootAccess;
        this.execute = executors ? _.reduce(customExecutors ? executors : acls, (reduction, value, key) => {
            if (customExecutors) {
                key = value;
            }

            const acl = _.get(this.acls, key);

            if (acl) {
                reduction = _.set(reduction, key, this.factory(key));
            }

            return reduction;
        }, {}) : {};
    }

    resolveRole(aclKey, role) {
        if (_.isArray(role)) {
            const acls = _.values(_.pick(aclKey, role));

            return _.first(acls);
        }

        return _.get(aclKey, role);
    }

    factory(key) {
        const aclKey = _.get(this.acls, key, false);

        if (!aclKey) {
            return () => rx.throwError(new Error(`There are no ACL's for ${key}`));
        }

        return (args, auth, options = {
            rejectSilently: false,
            onReject: null
        }) => {
            if (_.isNil(auth)) {
                return rx.throwError(new Error(`No auth object provided`));
            }

            let operation;
            let acl = (this.rootAccess && this.rootAccess === auth.role) ? true : this.resolveRole(aclKey, auth.role);

            if (_.isUndefined(acl)) {
                return rx.throwError(new Error(`There are no ACL's role for ${key}`));
            }

            if (_.isBoolean(acl) || _.isNull(acl)) {
                operation = rx.of(['boolean', acl]);
            } else if (_.isFunction(acl)) {
                operation = rx.of(['expression', acl]);
            } else {
                operation = rx.pairs(acl);
            }

            // handle args
            return operation.pipe(
                rx.mergeMap(([
                    type,
                    acl
                ]) => {
                    return this.handle(type, acl, args, auth);
                }),
                rx.reduce((reduction, args) => {
                    if (args === false) {
                        throw options.onReject ? options.onReject() : new Error(`ACL refused request`);
                    }

                    return _.isObject(args) ? _.extend({}, reduction, args) : args;
                }, {}),
                rx.catchError(err => {
                    if (options.rejectSilently) {
                        return rx.empty();
                    }

                    throw err;
                })
            );
        };
    }

    handle(type, acl, args, auth) {
        if (_.isNil(this[type])) {
            throw new Error('Inexistent ACL');
        }

        try {
            return this[type](acl, args, auth);
        } catch (err) {
            throw new Error(`Bad ACL: ${err.message}`);
        }
    }

    boolean(acl, args) {
        return acl ? rx.of(args) : rx.of(false);
    }

    expression(expression, args, auth) {
        let result = expression(args, auth, this.context);

        // wrap into an observable if not yet
        if (!(result instanceof rx.Observable)) {
            result = rx.of(result);
        }

        return result.pipe(
            rx.map(result => {
                if (result instanceof Error) {
                    throw result;
                }

                return result;
            })
        );
    }
};