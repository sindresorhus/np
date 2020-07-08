let tasks;

class SilentRenderer {
	constructor(_tasks) {
		tasks = _tasks;
	}

	static get tasks() {
		return tasks;
	}

	static get nonTTY() {
		return true;
	}

	render() { }

	end() { }
}

module.exports.SilentRenderer = SilentRenderer;
