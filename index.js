const _ = require('lodash');
const {
    Observable
} = require('rxjs');

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
            return () => Observable.throw(new Error(`There are no ACL's for ${key}`));
        }

        return (args, auth, options = {
            rejectSilently: false,
            onReject: null
        }) => {
            if (_.isNil(auth)) {
                return Observable.throw(new Error(`No auth object provided`));
            }

            let operation;
            let acl = (this.rootAccess && this.rootAccess === auth.role) ? true : this.resolveRole(aclKey, auth.role);

            if (_.isUndefined(acl)) {
                return Observable.throw(new Error(`There are no ACL's role for ${key}`));
            }

            if (_.isBoolean(acl) || _.isNull(acl)) {
                operation = Observable.of(['boolean', acl]);
            } else if (_.isFunction(acl)) {
                operation = Observable.of(['expression', acl]);
            } else {
                operation = Observable.pairs(acl);
            }

            // handle args
            return operation
                .mergeMap(([
                    type,
                    acl
                ]) => {
                    return this.handle(type, acl, args, auth);
                })
                .reduce((reduction, args) => {
                    if (args === false) {
                        throw options.onReject ? options.onReject() : new Error(`ACL refused request`);
                    }

                    return _.isObject(args) ? _.extend({}, reduction, args) : args;
                }, {})
                .catch(err => {
                    if (options.rejectSilently) {
                        return Observable.empty();
                    }

                    throw err;
                });
        }
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
        return acl ? Observable.of(args) : Observable.of(false);
    }

    expression(expression, args, auth) {
        let result;

        try {
            result = expression(args, auth, this.context);
        } catch (err) {
            throw err;
        }

        // wrap into an observable if not yet
        if (!(result instanceof Observable)) {
            result = Observable.of(result);
        }

        return result.map(result => {
            if (result instanceof Error) {
                throw result;
            }

            return result;
        });
    }
}