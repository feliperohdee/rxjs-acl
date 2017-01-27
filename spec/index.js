const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');

const _ = require('lodash');
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
	let params;
	let auth;

	beforeEach(() => {
		model = new Model();
		acl = new Acl(model, {});

		acl.acls = _.clone({
			model: {
				fetch: {
					someRole: true
				}
			}
		}, true);

		params = {
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

			fetch(params, auth)
				.mergeMap(model.fetch.bind(model))
				.subscribe(null, err => {
					expect(err.statusCode).to.equal(403);
					expect(err.message).to.equal('There are no ACL\'s namespace for inexistent.context');
					done();
				});
		});

		it('should return 403 if no params', done => {
			const fetch = acl.get('model.fetch');

			params = null;

			fetch(params, auth)
				.mergeMap(model.fetch.bind(model))
				.subscribe(null, err => {
					expect(err.statusCode).to.equal(403);
					expect(err.message).to.equal('No params object provided');
					done();
				});
		});

		it('should return 403 if no auth', done => {
			const fetch = acl.get('model.fetch');

			auth = null;

			fetch(params, auth)
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

			fetch(params, auth)
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
							expression: params => params.id = 'enforcedId'
						}
					}
				}
			}

			const fetch = acl.get('model.fetch');

			fetch(params, auth)
				.mergeMap(model.fetch.bind(model))
				.subscribe(null, err => {
					expect(err.statusCode).to.equal(403);
					expect(err.message).to.equal('Bad ACL');
					done();
				});
		});

		it('should block if acl expression is wrong', done => {
			acl.acls = {
				model: {
					fetch: {
						someRole: {
							type: 'conditionExpression',
							__expression: params => params.id = 'enforcedId'
						}
					}
				}
			}

			const fetch = acl.get('model.fetch');

			fetch(params, auth)
				.mergeMap(model.fetch.bind(model))
				.subscribe(null, err => {
					expect(err.statusCode).to.equal(403);
					expect(err.message).to.equal('Bad ACL: acl.expression is not a function');
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

			fetch(params, auth)
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

			fetch(params, auth)
				.mergeMap(model.fetch.bind(model))
				.subscribe(null, err => {
					expect(err.statusCode).to.equal(403);
					expect(err.message).to.equal('ACL refused request');
					done();
				});
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

			fetch(params, auth)
				.mergeMap(model.fetch.bind(model))
				.toArray()
				.subscribe(() => {
					expect(Model.fetchSpy).to.have.been.calledWith(params);
				}, null, done);
		});
	});

	describe('restrictGet', () => {
		describe('limit', () => {
			it('should params to have limit key when no one provided', done => {
				acl.acls = {
					model: {
						fetch: {
							someRole: {
								type: 'restrictGet',
								limit: 1
							}
						}
					}
				}

				const fetch = acl.get('model.fetch');

				fetch(params, auth)
					.do(params => {
						expect(params.limit).to.equal(1);
					})
					.mergeMap(model.fetch.bind(model))
					.toArray()
					.subscribe(() => {
						expect(Model.fetchSpy).to.have.been.calledWith(params);
					}, null, done);
			});

			it('should acl.limit to have precedence over params.limit when out of range', done => {
				acl.acls = {
					model: {
						fetch: {
							someRole: {
								type: 'restrictGet',
								limit: 1
							}
						}
					}
				}

				const fetch = acl.get('model.fetch');

				params.limit = 10;

				fetch(params, auth)
					.do(params => {
						expect(params.limit).to.equal(1);
					})
					.mergeMap(model.fetch.bind(model))
					.toArray()
					.subscribe(() => {
						expect(Model.fetchSpy).to.have.been.calledWith(params);
					}, null, done);
			});

			it('should params.limit to have precedence over acl.limit when in range', done => {
				acl.acls = {
					model: {
						fetch: {
							someRole: {
								type: 'restrictGet',
								limit: 10
							}
						}
					}
				}

				const fetch = acl.get('model.fetch');
				params.limit = 9;

				fetch(params, auth)
					.do(params => {
						expect(params.limit).to.equal(9);
					})
					.mergeMap(model.fetch.bind(model))
					.toArray()
					.subscribe(() => {
						expect(Model.fetchSpy).to.have.been.calledWith(params);
					}, null, done);
			});
		});

		describe('select', () => {
			it('should params to have select key when no one provided', done => {
				acl.acls = {
					model: {
						fetch: {
							someRole: {
								type: 'restrictGet',
								select: ['id']
							}
						}
					}
				}

				const fetch = acl.get('model.fetch');

				fetch(params, auth)
					.do(params => {
						expect(params.select).to.deep.equal(['id']);
					})
					.mergeMap(model.fetch.bind(model))
					.toArray()
					.subscribe(() => {
						expect(Model.fetchSpy).to.have.been.calledWith(params);
					}, null, done);
			});

			it('should acl.select to have precedence over params.select when out of range', done => {
				acl.acls = {
					model: {
						fetch: {
							someRole: {
								type: 'restrictGet',
								select: ['id']
							}
						}
					}
				}

				params.select = ['id', 'name', 'age'];

				const fetch = acl.get('model.fetch');

				fetch(params, auth)
					.do(params => {
						expect(params.select).to.deep.equal(['id']);
					})
					.mergeMap(model.fetch.bind(model))
					.toArray()
					.subscribe(() => {
						expect(Model.fetchSpy).to.have.been.calledWith(params);
					}, null, done);
			});

			it('should params.select to have precedence over acl.select when in range', done => {
				acl.acls = {
					model: {
						fetch: {
							someRole: {
								type: 'restrictGet',
								select: ['id', 'name', 'age']
							}
						}
					}
				}

				params.select = ['id', 'name'];

				const fetch = acl.get('model.fetch');

				fetch(params, auth)
					.do(params => {
						expect(params.select).to.deep.equal(['id', 'name']);
					})
					.mergeMap(model.fetch.bind(model))
					.toArray()
					.subscribe(() => {
						expect(Model.fetchSpy).to.have.been.calledWith(params);
					}, null, done);
			});
		});

		it('should throw if any select fields are provided', done => {
			acl.acls = {
				model: {
					fetch: {
						someRole: {
							type: 'restrictGet',
							select: ['id', 'name', 'age']
						}
					}
				}
			}

			params.select = ['_id', '_name'];

			const fetch = acl.get('model.fetch');

			fetch(params, auth)
				.subscribe(null, err => {
					expect(err.message).to.equal('None select field is allowed, you can select id,name,age');

					done();
				});
		});
	});

	describe('conditionExpression', () => {
		it('should pass params and model instance', done => {
			acl.acls = {
				model: {
					fetch: {
						someRole: {
							type: 'conditionExpression',
							expression: (params, model) => !!(params && model instanceof Model)
						}
					}
				}
			}

			const fetch = acl.get('model.fetch');

			fetch(params, auth)
				.mergeMap(model.fetch.bind(model))
				.toArray()
				.subscribe(() => {
					expect(Model.fetchSpy).to.have.been.calledWith(params);
				}, null, done);
		});

		it('should extend params', done => {
			acl.acls = {
				model: {
					fetch: {
						someRole: {
							type: 'conditionExpression',
							expression: params => _.extend({}, params, {
								id: auth.id
							})
						}
					}
				}
			}

			const fetch = acl.get('model.fetch');

			fetch(params, auth)
				.do(params => {
					expect(params.id).to.equal('someId');
				})
				.mergeMap(model.fetch.bind(model))
				.toArray()
				.subscribe(() => {
					expect(Model.fetchSpy).to.have.been.calledWith(params);
				}, null, done);
		});

		it('should block if condition not satisfied', done => {
			acl.acls = {
				model: {
					fetch: {
						someRole: {
							type: 'conditionExpression',
							expression: params => params.id === auth.id
						}
					}
				}
			}

			auth.id = 'wrongId';

			const fetch = acl.get('model.fetch');

			fetch(params, auth)
				.mergeMap(model.fetch.bind(model))
				.subscribe(null, err => {
					expect(err.statusCode).to.equal(403);
					expect(err.message).to.equal('Forbidden');
					done();
				});
		});

		it('should grant if condition satisfied', done => {
			acl.acls = {
				model: {
					fetch: {
						someRole: {
							type: 'conditionExpression',
							expression: params => params.id === auth.id
						}
					}
				}
			}

			const fetch = acl.get('model.fetch');

			fetch(params, auth)
				.mergeMap(model.fetch.bind(model))
				.toArray()
				.subscribe(() => {
					expect(Model.fetchSpy).to.have.been.calledWith(params);
				}, null, done);
		});

		it('should block with custom error if condition not satisfied', done => {
			acl.acls = {
				model: {
					fetch: {
						someRole: {
							type: 'conditionExpression',
							expression: params => params.id === auth.id,
							onError: 'unknown error'
						}
					}
				}
			}

			auth.id = 'wrongId';

			const fetch = acl.get('model.fetch');

			fetch(params, auth)
				.mergeMap(model.fetch.bind(model))
				.subscribe(null, err => {
					expect(err.statusCode).to.equal(403);
					expect(err.message).to.equal('unknown error');
					done();
				});
		});

		it('should handle observable throwing and ensure that error is wrapped around http.error', done => {
			acl.acls = {
				model: {
					fetch: {
						someRole: {
							type: 'conditionExpression',
							expression: params => Observable.throw('Observable throw')
						}
					}
				}
			}

			const fetch = acl.get('model.fetch');

			fetch(params, auth)
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
							type: 'conditionExpression',
							expression: params => Observable.of(false)
						}
					}
				}
			}

			const fetch = acl.get('model.fetch');

			fetch(params, auth)
				.mergeMap(model.fetch.bind(model))
				.subscribe(null, err => {
					expect(err.statusCode).to.equal(403);
					expect(err.message).to.equal('Forbidden');
					done();
				});
		});

		it('should handle observable granting', done => {
			acl.acls = {
				model: {
					fetch: {
						someRole: {
							type: 'conditionExpression',
							expression: params => Observable.of(true)
						}
					}
				}
			}

			const fetch = acl.get('model.fetch');

			fetch(params, auth)
				.mergeMap(model.fetch.bind(model))
				.toArray()
				.subscribe(() => {
					expect(Model.fetchSpy).to.have.been.calledWith(params);
				}, null, done);
		});
	});

	describe('combined', () => {
		it('should accept combined ACL\'s', done => {
			acl.acls = {
				model: {
					fetch: {
						someRole: [{
							type: 'conditionExpression',
							expression: params => params.id === auth.id
						}, {
							type: 'conditionExpression',
							expression: params => _.extend({}, params, {
								id: 'enforcedId'
							})
						}, {
							type: 'conditionExpression',
							expression: params => Observable.of(true)
						},{
							type: 'restrictGet',
							select: ['id'],
							limit: 5
						}]
					}
				}
			}

			const fetch = acl.get('model.fetch');

			fetch(params, auth)
				.do(aclParams => {
					expect(aclParams.id).to.equal('enforcedId');
					expect(aclParams.select).to.deep.equal(['id']);
					expect(aclParams.limit).to.equal(5);

					params = aclParams;
				})
				.mergeMap(model.fetch.bind(model))
				.toArray()
				.subscribe(() => {
					expect(Model.fetchSpy).to.have.been.calledWith(params);
				}, null, done);
		});
	});
});
