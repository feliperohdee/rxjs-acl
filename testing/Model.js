const sinon = require('sinon');

const _ = require('../lodash');
const rx = require('../rx');

class Model {
	fetch(params) {
		Model.fetchSpy(params);

		return rx.from(_.range(10));
	}

	get(params) {
		Model.getSpy(params);

		return rx.of(1);
	}
}

Model.fetchSpy = sinon.spy();
Model.getSpy = sinon.spy();

module.exports = Model;
