const sinon = require('sinon');

const _ = require('lodash');
const {
	Observable
} = require('rxjs');

class Model {
	fetch(params) {
		Model.fetchSpy(params);

		return Observable.from(_.range(10));
	}

	get(params) {
		Model.getSpy(params);

		return Observable.of(1);
	}
}

Model.fetchSpy = sinon.spy();
Model.getSpy = sinon.spy();

module.exports = Model;
