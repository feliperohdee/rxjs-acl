[![CircleCI](https://circleci.com/gh/feliperohdee/smallorange-acl.svg?style=svg)](https://circleci.com/gh/feliperohdee/smallorange-acl)

# Small Orange ACL

Reactive ACL's based on RxJS

## Usage

		const Acl = require('smallorange-acl');
		const = new Model();

		const mockedParams = {
			id: 'someId',
			select: ['id', 'name', 'password'],
			limit: 100
		};

		const mockedAuth = {
			namespace: 'someNamespace',
			role: 'admin',
			id: 'someId'
		};

		const aclRules = {
			// context
			model: {
				// method or operation
				fetch: {
					// roles
					public: [{
						type: 'conditionExpression',
						expression: (params, model) => !!auth.id // should have auth.id
					}, {
						type: 'conditionExpression',
						expression: (params, model) => model.get(auth.id)
							.map(response => !!response) // can return an Observable, confirming user existence for example
					}, {
						type: 'conditionExpression',
						expression: (params, model) => params.id = auth.id // enforce params.id to be same of auth.id
					}, {
						type: 'restrictGet',
						limit: 10, // restrict params.limit to 10
						select: ['id', 'name'] // restrict params.select to just id,name
					}],
					admin: true // grant free access,
					unpredictable: false // block all access
				}
			}
		};

		const acl = new Acl(model, aclRules);
		const modelAclContext = acl.get('model.fetch');
		
		modelAclContext(mockedParams, mockedAuth)
				.mergeMap(aclParams => model.fetch(aclParams))
				.subscribe(nextFn, errFn);
