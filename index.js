const _ = require('lodash');
const createError = require('http-errors');
const {
    Observable
} = require('rxjs');

module.exports = class Acl {
    constructor(acls, model, options = {}) {
        this.acls = acls;
        this.model = model;
        this.options = options;
    }

    get(namespace) {
        const aclContext = _.get(this.acls, namespace, false);

        if (!aclContext) {
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
            let acl = _.get(aclContext, auth.role);

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

    select(selection, args) {
        if (!_.isArray(selection)) {
            selection = [selection];
        }

        const select = _.intersection(args.select || selection, selection);

        if (_.isEmpty(select)) {
            return Observable.throw(`None select field is allowed, you can select ${selection.join(',')}`);
        }

        return Observable.of({
            select
        });
    }

    limit(max, args) {
        const limit = _.inRange(args.limit, 1, max) ? args.limit : max;

        return Observable.of({
            limit
        });
    }

    expression(expression, args, auth) {
        let result;

        try {
            result = expression(args, auth, this.model);
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
