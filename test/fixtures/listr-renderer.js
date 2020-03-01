
class SilentRenderer {
	constructor(_tasks) {
		module.exports.tasks = _tasks;
	}

	static get nonTTY() {
		return true;
	}

	render() {
	}

	end() {

	}
}

module.exports.SilentRenderer = SilentRenderer;

