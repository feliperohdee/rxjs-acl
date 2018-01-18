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
						expression: (args, auth, context) => {
							// ensure auth.id
							if(!auth.id){
								return false;	
							}
							
							// can return an Observable, confirming user existence for example
							return context.model.get(auth.id)
									.map(response => !!response);
						}
					},
					admin: true // grant free access,
					unpredictable: false // block all access
				}
			}
		};

		const acl = new Acl(aclRules, {
			model
		});
		
		const modelAclContext = acl.get('model.fetch');
		
		modelAclContext(mockedArgs, mockedAuth, {
					rejectSilently: boolean,
					onReject: function
				})
				.mergeMap(aclargs => model.fetch(aclargs))
				.subscribe(nextFn, errFn);
