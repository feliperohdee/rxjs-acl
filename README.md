[![CircleCI](https://circleci.com/gh/feliperohdee/smallorange-acl.svg?style=svg)](https://circleci.com/gh/feliperohdee/smallorange-acl)

# Small Orange ACL

Reactive ACL's based on RxJS

## Usage

		const Acl = require('smallorange-acl');
		const = new Model();

		const mockedArgs = {
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
					public: {
						expression: (args, auth, model) => {
							// ensure auth.id
							if(!auth.id){
								return false;	
							}
							
							// can return an Observable, confirming user existence for example
							return model.get(auth.id)
									.map(response => !!response);
						},
						limit: 10, // restrict args.limit to 10
						select: ['id', 'name'] // restrict args.select to just id,name
					},
					admin: true // grant free access,
					unpredictable: false // block all access
				}
			}
		};

		const acl = new Acl(model, aclRules);
		const modelAclContext = acl.get('model.fetch');
		
		modelAclContext(mockedArgs, mockedAuth)
				.mergeMap(aclargs => model.fetch(aclargs))
				.subscribe(nextFn, errFn);
