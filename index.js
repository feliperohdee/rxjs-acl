const _ = require('lodash');
const createError = require('http-errors');
const {
    Observable
} = require('rxjs');

module.exports = class Acl {
    constructor(acls, context, factory) {
        this.acls = acls;
        this.context = context;

        this.execute = _.reduce(factory, (reduction, key) => {
            const acl = _.get(this.acls, key, null);

            if(acl) {
                reduction = _.set(reduction, key, this.get(key));
            }

            return reduction;
        }, {});
    }

    resolveRole(aclNamespace, role){
        if(_.isArray(role)){
            const acls = _.values(_.pick(aclNamespace, role));
            
            return _.first(acls);
        }

        return _.get(aclNamespace, role);
    }

    get(namespace) {
        const aclNamespace = _.get(this.acls, namespace, false);

        if (!aclNamespace) {
            return () => Observable.throw(createError(403, `There are no ACL's namespace for ${namespace}`));
        }

        return (args, auth, options = {
            rejectSilently: false
        }) => {
            if (_.isNil(args)) {
                return Observable.throw(createError(403, `No args object provided`));
            }

            if (_.isNil(auth)) {
                return Observable.throw(createError(403, `No auth object provided`));
            }

            let operation;
            let acl = this.resolveRole(aclNamespace, auth.role);

            if (_.isUndefined(acl)) {
                return Observable.throw(createError(403, `There are no ACL's role for ${namespace}`));
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
                ]) => this.handle(type, acl, args, auth))
                .reduce((reduction, args) => {
                    if(!args){
                        throw createError(403, `ACL refused request`);
                    }

                    return _.extend({}, reduction, args);
                }, args)
                .catch(err => {
                    if (options.rejectSilently) {
                        return Observable.empty();
                    }

                    throw createError(err.status || 500, err);
                });
        }
    }

    handle(type, acl, args, auth) {
        if (_.isNil(this[type])) {
            throw createError(403, 'Inexistent ACL');
        }

        try {
            return this[type](acl, args, auth);
        } catch (err) {
            throw createError(403, `Bad ACL: ${err.message}`);
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
                throw createError(result);
            }

            return result;
        });
    }
}
