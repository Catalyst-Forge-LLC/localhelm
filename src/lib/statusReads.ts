/** Request order belongs to each subject, so refreshing B does not discard A. */
export type StatusRead = { sequence: number; epoch: number; ids: readonly string[] };

export class StatusReads {
	private sequence = 0;
	private epoch = 0;
	private full = 0;
	private rows = new Map<string, number>();
	private active = new Set<number>();

	begin(ids: readonly string[] = []): StatusRead {
		const sequence = ++this.sequence;
		this.active.add(sequence);
		if (!ids.length) {
			this.full = sequence;
			this.rows.clear();
		} else for (const id of ids) this.rows.set(id, sequence);
		return { sequence, epoch: this.epoch, ids: [...ids] };
	}

	accepts(read: StatusRead, id: string): boolean {
		return read.epoch === this.epoch && read.sequence >= this.full && read.sequence >= (this.rows.get(id) ?? 0)
			&& (!read.ids.length || read.ids.includes(id));
	}

	current(read: StatusRead): boolean { return read.epoch === this.epoch; }
	latest(read: StatusRead): boolean { return this.current(read) && read.sequence === this.sequence; }
	finish(read: StatusRead): void { if (this.current(read)) this.active.delete(read.sequence); }
	get pending(): boolean { return this.active.size > 0; }

	reset(): void {
		this.epoch++;
		this.full = ++this.sequence;
		this.rows.clear();
		this.active.clear();
	}
}
