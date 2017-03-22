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
		acl = new Acl({}, model);

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

	describe('no ACL context, no ACL role, wrong ACL', () => {
		it('should return 403 if no ACL context', done => {
			const fetch = acl.get('inexistent.context');

			fetch(args, auth)
				.mergeMap(model.fetch.bind(model))
				.subscribe(null, err => {
					expect(err.statusCode).to.equal(403);
					expect(err.message).to.equal('There are no ACL\'s namespace for inexistent.context');
					done();
				});
		});

		it('should return 403 if no args', done => {
			const fetch = acl.get('model.fetch');

			args = null;

			fetch(args, auth)
				.mergeMap(model.fetch.bind(model))
				.subscribe(null, err => {
					expect(err.statusCode).to.equal(403);
					expect(err.message).to.equal('No args object provided');
					done();
				});
		});

		it('should return 403 if no auth', done => {
			const fetch = acl.get('model.fetch');

			auth = null;

			fetch(args, auth)
				.mergeMap(model.fetch.bind(model))
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
				.mergeMap(model.fetch.bind(model))
				.subscribe(null, err => {
					expect(err.statusCode).to.equal(403);
					expect(err.message).to.equal('There are no ACL\'s role for model.fetch');
					done();
				});
		});

		it('should block if inexistent acl type', done => {
			acl.acls = {
				model: {
					fetch: {
						someRole: {
							type: '___conditionExpression',
							expression: args => args.id = 'enforcedId'
						}
					}
				}
			}

			const fetch = acl.get('model.fetch');

			fetch(args, auth)
				.mergeMap(model.fetch.bind(model))
				.subscribe(null, err => {
					expect(err.statusCode).to.equal(403);
					expect(err.message).to.equal('Inexistent ACL');
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
				.mergeMap(model.fetch.bind(model))
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
				.mergeMap(model.fetch.bind(model))
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
				.mergeMap(model.fetch.bind(model))
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

	describe('select', () => {
		it('should args to have select key when no one provided', done => {
			acl.acls = {
				model: {
					fetch: {
						someRole: {
							select: ['id']
						}
					}
				}
			}

			const fetch = acl.get('model.fetch');

			fetch(args, auth)
				.do(args => {
					expect(args.select).to.deep.equal(['id']);
				})
				.mergeMap(model.fetch.bind(model))
				.toArray()
				.subscribe(() => {
					expect(Model.fetchSpy).to.have.been.calledWith(args);
				}, null, done);
		});

		it('should acl.select restrict args.select when out of range', done => {
			acl.acls = {
				model: {
					fetch: {
						someRole: {
							select: ['id']
						}
					}
				}
			}

			args.select = ['id', 'name', 'age'];

			const fetch = acl.get('model.fetch');

			fetch(args, auth)
				.do(args => {
					expect(args.select).to.deep.equal(['id']);
				})
				.mergeMap(model.fetch.bind(model))
				.toArray()
				.subscribe(() => {
					expect(Model.fetchSpy).to.have.been.calledWith({
						id: 'someId',
						select: ['id']
					});
				}, null, done);
		});

		it('should args.select not restrict acl.select when in range', done => {
			acl.acls = {
				model: {
					fetch: {
						someRole: {
							select: ['id', 'name', 'age']
						}
					}
				}
			}

			args.select = ['id', 'name'];

			const fetch = acl.get('model.fetch');

			fetch(args, auth)
				.do(args => {
					expect(args.select).to.deep.equal(['id', 'name']);
				})
				.mergeMap(model.fetch.bind(model))
				.toArray()
				.subscribe(() => {
					expect(Model.fetchSpy).to.have.been.calledWith(args);
				}, null, done);
		});

		it('should handle no arrays', done => {
			acl.acls = {
				model: {
					fetch: {
						someRole: {
							select: 'id'
						}
					}
				}
			}

			args.select = ['id', 'name', 'age'];

			const fetch = acl.get('model.fetch');

			fetch(args, auth)
				.subscribe(args => {
					expect(args.select).to.deep.equal(['id']);
				}, null, done);
		});

		it('should throw if no select fields are provided', done => {
			acl.acls = {
				model: {
					fetch: {
						someRole: {
							select: ['id', 'name', 'age']
						}
					}
				}
			}

			args.select = ['_id', '_name'];

			const fetch = acl.get('model.fetch');

			fetch(args, auth)
				.subscribe(null, err => {
					expect(err.message).to.equal('None select field is allowed, you can select id,name,age');

					done();
				});
		});
	});

	describe('limit', () => {
		it('should args to have limit key when no one provided', done => {
			acl.acls = {
				model: {
					fetch: {
						someRole: {
							limit: 1
						}
					}
				}
			}

			const fetch = acl.get('model.fetch');

			fetch(args, auth)
				.do(args => {
					expect(args.limit).to.equal(1);
				})
				.mergeMap(model.fetch.bind(model))
				.toArray()
				.subscribe(() => {
					expect(Model.fetchSpy).to.have.been.calledWith(args);
				}, null, done);
		});

		it('should acl.limit restrict args.limit when out of range', done => {
			acl.acls = {
				model: {
					fetch: {
						someRole: {
							limit: 1
						}
					}
				}
			}

			const fetch = acl.get('model.fetch');

			args.limit = 10;

			fetch(args, auth)
				.do(args => {
					expect(args.limit).to.equal(1);
				})
				.mergeMap(model.fetch.bind(model))
				.toArray()
				.subscribe(() => {
					expect(Model.fetchSpy).to.have.been.calledWith({
						id: 'someId',
						limit: 1
					});
				}, null, done);
		});

		it('should args.limit to have precedence over acl.limit when in range', done => {
			acl.acls = {
				model: {
					fetch: {
						someRole: {
							limit: 10
						}
					}
				}
			}

			const fetch = acl.get('model.fetch');
			args.limit = 9;

			fetch(args, auth)
				.do(args => {
					expect(args.limit).to.equal(9);
				})
				.mergeMap(model.fetch.bind(model))
				.toArray()
				.subscribe(() => {
					expect(Model.fetchSpy).to.have.been.calledWith(args);
				}, null, done);
		});
	});

	describe('expression', () => {
		it('should pass args, auth and model instance', done => {
			acl.acls = {
				model: {
					fetch: {
						someRole: {
							expression: (args, auth, model) => !!(args && auth && model instanceof Model)
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
						someRole: (args, auth, model) => !!(args && auth && model instanceof Model)
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
							expression: args => ({
								id: 'enforcedId'
							}),
							limit: 5,
							select: ['id']
						}
					}
				}
			};

			const fetch = acl.get('model.fetch');

			fetch(args, auth)
				.do(aclArgs => {
					expect(aclArgs.id).to.equal('enforcedId');
					expect(aclArgs.select).to.deep.equal(['id']);
					expect(aclArgs.limit).to.equal(5);

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
