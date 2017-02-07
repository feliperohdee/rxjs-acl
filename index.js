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

        return (params, auth) => Observable.create(subscriber => {
            if (_.isNil(params)) {
                return subscriber.error(createError(403, `No params object provided`));
            }

            if (_.isNil(auth)) {
                return subscriber.error(createError(403, `No auth object provided`));
            }

            let acl = _.get(aclContext, auth.role);

            if (_.isUndefined(acl)) {
                return subscriber.error(createError(403, `There are no ACL's role for ${namespace}`));
            }

            if (!_.isArray(acl)) {
                acl = [acl];
            }

            // handle params
            Observable.from(acl)
                .mergeMap(acl => this.handleAcl(acl, params))
                .subscribe(aclParams => {
                    params = aclParams;
                }, err => {
                    if (_.isString(err)) {
                        err = createError(500, err);
                    }

                    subscriber.error(err);
                }, () => {
                    subscriber.next(params);
                    subscriber.complete();
                });
        });
    }

    handleAcl(acl, params) {
        if (_.isBoolean(acl) || _.isNull(acl)) {
            return acl ? Observable.of(params) : Observable.throw(createError(403, `ACL refused request`));
        }

        if (_.isNil(this[acl.type])) {
            throw createError(403, 'Bad ACL');
        }

        try {
            return this[acl.type](acl, params);
        } catch (err) {
            throw createError(403, `Bad ACL: ${err.message}`);
        }
    }

    restrictGet(acl, params) {
        if (acl.select) {
            params.select = _.intersection(params.select || acl.select, acl.select);

            if (_.isEmpty(params.select)) {
                return Observable.throw(`None select field is allowed, you can select ${acl.select.join(',')}`);
            }
        }

        if (acl.limit) {
            params.limit = _.inRange(params.limit, 1, acl.limit) ? params.limit : acl.limit;
        }


        return Observable.of(params);
    }

    conditionExpression(acl, params) {
        let result;

        try {
            result = acl.expression(params, this.model);
        } catch (err) {
            throw err;
        }

        // wrap into an observable if not yet
        if (!(result instanceof Observable)) {
            result = Observable.of(result);
        }

        return result.map(result => {
            if (!result) {
                throw createError(403, acl.onError);
            }

            return _.extend({}, params, result);
        });
    }
}
