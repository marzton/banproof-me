export class WorkflowEntrypoint {
  async run() {}
}
export class WorkflowEvent {}
export class WorkflowStep {
  async do(name, fn) {
    if (typeof fn === 'function') {
      return fn();
    }
    // handle case where retries object is passed as second argument
    if (arguments.length > 2 && typeof arguments[2] === 'function') {
      return arguments[2]();
    }
  }
}
