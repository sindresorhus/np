let tasks;

export class SilentRenderer {
	constructor(_tasks) {
		tasks = _tasks;
	}

	static get tasks() {
		return tasks;
	}

	static get nonTTY() {
		return true;
	}

	static clearTasks() {
		tasks = [];
	}

	render() {}

	end() {}
}
