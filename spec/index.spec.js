const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');

const _ = require('lodash');
const createError = require('http-errors');
const {
	Observable
} = require('rxjs');

const Model = require('../testing/Model');
const Acl = require('../');

const expect = chai.expect;

chai.use(sinonChai);

describe('index.js', () => {
	let acl;
	let model;
	let args;
	let auth;

	beforeEach(() => {
		model = new Model();
		acl = new Acl({}, {
			model
		});

		acl.acls = _.clone({
			model: {
				fetch: {
					someRole: true
				}
			}
		}, true);

		args = {
			id: 'someId'
		};

		auth = _.clone({
			namespace: 'someNamespace',
			role: 'someRole',
			id: 'someId'
		}, true);
	});

	describe('constructor', () => {
		it('should create executors from factories', () => {
			acl = new Acl(acl.acls, null, [
				'model.fetch',
				'inexistent'
			]);

			expect(_.size(acl.execute)).to.equal(1);
			expect(acl.execute.model.fetch).to.be.a('function');
		});
	});

	describe('resolveRole', () => {
		it('should resolve get single role', () => {
			const role = acl.resolveRole(acl.acls.model.fetch, 'someRole');

			expect(role).to.be.true;
		});

		it('should return undefined if single role doesn\'t exists', () => {
			const role = acl.resolveRole(acl.acls.model.fetch, 'inexistentRole');

			expect(role).to.be.undefined;
		});

		it('should resolve get first valid role', () => {
			const role = acl.resolveRole(acl.acls.model.fetch, ['inexistentRole', 'someRole']);

			expect(role).to.be.true;
		});

		it('should return undefined if all roles doesn\'t exists', () => {
			const role = acl.resolveRole(acl.acls.model.fetch, ['inexistentRole', 'inexistentRole2']);

			expect(role).to.be.undefined;
		});
	});

	describe('get', () => {
		beforeEach(() => {
			sinon.stub(acl, 'handle')
				.returns(Observable.of(true));
		});

		afterEach(() => {
			acl.handle.restore();
		});

		it('should call handle with single level', done => {
			acl.acls = acl.acls.model;

			const fetch = acl.get('fetch');

			fetch(args, auth)
				.subscribe(() => {
					expect(acl.handle).to.have.been.calledWith('boolean', true, args, auth);
				}, null, done);
		});

		it('should call handle with 2 levels', done => {
			const fetch = acl.get('model.fetch');

			fetch(args, auth)
				.subscribe(() => {
					expect(acl.handle).to.have.been.calledWith('boolean', true, args, auth);
				}, null, done);
		});

		it('should call handle with 3 levels or more', done => {
			acl.acls.main = acl.acls;

			const fetch = acl.get('main.model.fetch');

			fetch(args, auth)
				.subscribe(() => {
					expect(acl.handle).to.have.been.calledWith('boolean', true, args, auth);
				}, null, done);
		});

		describe('no ACL context, no ACL role, wrong ACL', () => {
			it('should return 403 if no ACL context', done => {
				const fetch = acl.get('inexistent.context');

				fetch(args, auth)
					.subscribe(null, err => {
						expect(err.statusCode).to.equal(403);
						expect(err.message).to.equal('There are no ACL\'s namespace for inexistent.context');
						done();
					});
			});

			it('should return 403 if no auth', done => {
				const fetch = acl.get('model.fetch');

				auth = null;

				fetch(args, auth)
					.subscribe(null, err => {
						expect(err.statusCode).to.equal(403);
						expect(err.message).to.equal('No auth object provided');
						done();
					});
			});

			it('should return 403 if no ACL role', done => {
				const fetch = acl.get('model.fetch');

				auth.role = 'forbiddenRole';

				fetch(args, auth)
					.subscribe(null, err => {
						expect(err.statusCode).to.equal(403);
						expect(err.message).to.equal('There are no ACL\'s role for model.fetch');
						done();
					});
			});
		});
	});

	describe('handle', () => {
		beforeEach(() => {
			sinon.stub(acl, 'boolean')
				.returns(Observable.of(true));
			sinon.stub(acl, 'expression')
				.returns(Observable.of(true));
		});

		afterEach(() => {
			acl.boolean.restore();
			acl.expression.restore();
		});

		it('should block if inexistent acl type', done => {
			acl.acls = {
				model: {
					fetch: {
						someRole: {
							__expression: args => args.id = 'enforcedId'
						}
					}
				}
			}

			const fetch = acl.get('model.fetch');

			fetch(args, auth)
				.subscribe(null, err => {
					expect(err.statusCode).to.equal(403);
					expect(err.message).to.equal('Inexistent ACL');
					done();
				});
		});

		it('should call boolean with empty object', done => {
			const fetch = acl.get('model.fetch');

			Observable.forkJoin(
					fetch(null, auth),
					fetch(undefined, auth)
				)
				.subscribe(() => {
					expect(acl.boolean).to.have.always.been.calledWith(true, {}, auth);
				}, null, done);
		});

		it('should call boolean', done => {
			const fetch = acl.get('model.fetch');

			fetch(args, auth)
				.subscribe(() => {
					expect(acl.boolean).to.have.been.calledWith(true, args, auth);
				}, null, done);
		});

		it('should call expression', done => {
			const expression = () => true;

			acl.acls = {
				model: {
					fetch: {
						someRole: {
							expression
						}
					}
				}
			}

			const fetch = acl.get('model.fetch');

			fetch(args, auth)
				.subscribe(() => {
					expect(acl.expression).to.have.been.calledWith(expression, args, auth);
				}, null, done);
		});

		it('should handle exception', done => {
			acl.boolean.restore();

			sinon.stub(acl, 'boolean')
				.throws(new Error('ops...'));

			const fetch = acl.get('model.fetch');

			fetch(args, auth)
				.subscribe(null, err => {
					expect(err.message).to.equal('Bad ACL: ops...');
					done();
				});
		});
	});

	describe('boolean', () => {
		it('should block if false', done => {
			acl.acls = {
				model: {
					fetch: {
						someRole: false
					}
				}
			}

			const fetch = acl.get('model.fetch');

			fetch(args, auth)
				.subscribe(null, err => {
					expect(err.statusCode).to.equal(403);
					expect(err.message).to.equal('ACL refused request');
					done();
				});
		});

		it('should block if null', done => {
			acl.acls = {
				model: {
					fetch: {
						someRole: null
					}
				}
			}

			const fetch = acl.get('model.fetch');

			fetch(args, auth)
				.subscribe(null, err => {
					expect(err.statusCode).to.equal(403);
					expect(err.message).to.equal('ACL refused request');
					done();
				});
		});

		it('should block silently', done => {
			acl.acls = {
				model: {
					fetch: {
						someRole: null
					}
				}
			}

			const fetch = acl.get('model.fetch');

			fetch(args, auth, {
					rejectSilently: true
				})
				.subscribe(null, null, done);
		});


		it('should grant if true', done => {
			acl.acls = {
				model: {
					fetch: {
						someRole: true
					}
				}
			}

			const fetch = acl.get('model.fetch');

			fetch(args, auth)
				.mergeMap(model.fetch.bind(model))
				.toArray()
				.subscribe(() => {
					expect(Model.fetchSpy).to.have.been.calledWith(args);
				}, null, done);
		});
	});

	describe('expression', () => {
		it('should pass args, auth and context', done => {
			acl.acls = {
				model: {
					fetch: {
						someRole: {
							expression: (args, auth, context) => !!(args && auth && context.model instanceof Model)
						}
					}
				}
			}

			const fetch = acl.get('model.fetch');

			fetch(args, auth)
				.mergeMap(model.fetch.bind(model))
				.toArray()
				.subscribe(() => {
					expect(Model.fetchSpy).to.have.been.calledWith(args);
				}, null, done);
		});

		it('should handle implicit expression', done => {
			acl.acls = {
				model: {
					fetch: {
						someRole: (args, auth, context) => !!(args && auth && context.model instanceof Model)
					}
				}
			}

			const fetch = acl.get('model.fetch');

			fetch(args, auth)
				.mergeMap(model.fetch.bind(model))
				.toArray()
				.subscribe(() => {
					expect(Model.fetchSpy).to.have.been.calledWith(args);
				}, null, done);
		});

		it('should handle expression exception', done => {
			acl.acls = {
				model: {
					fetch: {
						someRole: (args, auth, model) => {
							throw new Error('error');
						}
					}
				}
			}

			const fetch = acl.get('model.fetch');

			fetch(args, auth)
				.mergeMap(model.fetch.bind(model))
				.toArray()
				.subscribe(null, err => {
					expect(err.message).to.equal('Bad ACL: error');
					done();
				});
		});

		it('should extend args', done => {
			acl.acls = {
				model: {
					fetch: {
						someRole: {
							expression: args => _.extend({}, args, {
								extended: 'extended'
							})
						}
					}
				}
			}

			const fetch = acl.get('model.fetch');

			fetch(args, auth)
				.do(args => {
					expect(args.extended).to.equal('extended');
				})
				.mergeMap(model.fetch.bind(model))
				.toArray()
				.subscribe(() => {
					expect(Model.fetchSpy).to.have.been.calledWith({
						id: 'someId',
						extended: 'extended'
					});
				}, null, done);
		});

		it('should block if condition not satisfied', done => {
			acl.acls = {
				model: {
					fetch: {
						someRole: {
							expression: args => args.id === auth.id
						}
					}
				}
			}

			auth.id = 'wrongId';

			const fetch = acl.get('model.fetch');

			fetch(args, auth)
				.mergeMap(model.fetch.bind(model))
				.subscribe(null, err => {
					expect(err.statusCode).to.equal(403);
					expect(err.message).to.equal('ACL refused request');
					done();
				});
		});

		it('should grant if condition satisfied', done => {
			acl.acls = {
				model: {
					fetch: {
						someRole: {
							expression: args => args.id === auth.id
						}
					}
				}
			}

			const fetch = acl.get('model.fetch');

			fetch(args, auth)
				.mergeMap(model.fetch.bind(model))
				.toArray()
				.subscribe(() => {
					expect(Model.fetchSpy).to.have.been.calledWith(args);
				}, null, done);
		});

		it('should block with custom error if returns an error', done => {
			acl.acls = {
				model: {
					fetch: {
						someRole: {
							expression: args => createError(404, 'Unknown error')
						}
					}
				}
			}

			auth.id = 'wrongId';

			const fetch = acl.get('model.fetch');

			fetch(args, auth)
				.mergeMap(model.fetch.bind(model))
				.subscribe(null, err => {
					expect(err.statusCode).to.equal(404);
					expect(err.message).to.equal('Unknown error');
					done();
				});
		});

		it('should handle observable throwing and ensure that error is wrapped around http.error', done => {
			acl.acls = {
				model: {
					fetch: {
						someRole: {
							expression: args => Observable.throw('Observable throw')
						}
					}
				}
			}

			const fetch = acl.get('model.fetch');

			fetch(args, auth)
				.mergeMap(model.fetch.bind(model))
				.subscribe(null, err => {
					expect(err.statusCode).to.equal(500);
					expect(err.message).to.equal('Observable throw');
					done();
				});
		});

		it('should handle observable rejecting and ensure that error is wrapped around http.error', done => {
			acl.acls = {
				model: {
					fetch: {
						someRole: {
							expression: args => Observable.of(false)
						}
					}
				}
			}

			const fetch = acl.get('model.fetch');

			fetch(args, auth)
				.mergeMap(model.fetch.bind(model))
				.subscribe(null, err => {
					expect(err.statusCode).to.equal(403);
					expect(err.message).to.equal('ACL refused request');
					done();
				});
		});

		it('should handle observable granting', done => {
			acl.acls = {
				model: {
					fetch: {
						someRole: {
							expression: args => Observable.of(true)
						}
					}
				}
			}

			const fetch = acl.get('model.fetch');

			fetch(args, auth)
				.mergeMap(model.fetch.bind(model))
				.toArray()
				.subscribe(() => {
					expect(Model.fetchSpy).to.have.been.calledWith(args);
				}, null, done);
		});
	});

	describe('combined', () => {
		it('should accept composed ACL\'s', done => {
			acl.acls = {
				model: {
					fetch: {
						someRole: {
							boolean: true,
							expression: args => ({
								id: 'enforcedId'
							})
						}
					}
				}
			};

			const fetch = acl.get('model.fetch');

			fetch(args, auth)
				.do(aclArgs => {
					expect(aclArgs.id).to.equal('enforcedId');

					args = aclArgs;
				})
				.mergeMap(model.fetch.bind(model))
				.toArray()
				.subscribe(() => {
					expect(Model.fetchSpy).to.have.been.calledWith(args);
				}, null, done);
		});
	});
});
