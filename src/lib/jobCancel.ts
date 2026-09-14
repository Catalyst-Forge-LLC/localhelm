/** Operator asked to stop a multi-id apply. The current item may still finish. */
export class JobCancelledError extends Error {
	readonly done: number;
	readonly total: number;

	constructor(done: number, total: number) {
		super(stoppedJobMessage(done, total));
		this.name = 'JobCancelledError';
		this.done = done;
		this.total = total;
	}
}

export function stoppedJobMessage(done: number, total: number): string {
	if (done <= 0) return `Stopped before the first of ${total}. Nothing else will run.`;
	return `Stopped after ${done} of ${total}. The rest were not started.`;
}

export function isJobCancelled(err: unknown): err is JobCancelledError {
	return err instanceof JobCancelledError || (err instanceof Error && err.name === 'JobCancelledError');
}
