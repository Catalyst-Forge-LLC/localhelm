import assert from 'node:assert/strict';
import { it } from 'node:test';
import { INCOMPLETE_PROGRESS, readProgressResponse } from './progressResponse.js';

function streamed(text: string, split = 1): Response {
	const bytes = new TextEncoder().encode(text);
	return new Response(new ReadableStream({ start(controller) {
		for (let at = 0; at < bytes.length; at += split) controller.enqueue(bytes.slice(at, at + split));
		controller.close();
	} }), { headers: { 'content-type': 'application/x-ndjson' } });
}

it('reads split UTF-8 progress and a final result without a newline', async () => {
	const events: unknown[] = [];
	assert.deepEqual(await readProgressResponse(streamed('{"type":"progress","label":"répo ⚔"}\n{"type":"result","rows":["ok"]}'), event => events.push(event)), { type: 'result', rows: ['ok'] });
	assert.deepEqual(events, [{ type: 'progress', label: 'répo ⚔' }]);
});

it('never calls an empty or truncated stream a successful action', async () => {
	for (const text of ['', '{"type":"step","status":"done"}\n', '{"type":"result",']) {
		await assert.rejects(readProgressResponse(streamed(text), () => {}), /Refresh status/);
	}
});

it('keeps server failure reasons and rejects failed HTTP responses', async () => {
	await assert.rejects(readProgressResponse(streamed('{"type":"error","error":"origin is unreachable"}'), () => {}), /origin is unreachable/);
	await assert.rejects(readProgressResponse(new Response('{"type":"result"}', { status: 503, headers: { 'content-type': 'application/x-ndjson' } }), () => {}), /503/);
	await assert.rejects(readProgressResponse(new Response('{"error":"job locked"}', { status: 409 }), () => {}), /job locked/);
});

it('reports an interrupted connection without implying the write was rolled back', async () => {
	const response = new Response(new ReadableStream({ pull(controller) { controller.error(new Error('socket reset')); } }), { headers: { 'content-type': 'application/x-ndjson' } });
	await assert.rejects(readProgressResponse(response, () => {}), { message: INCOMPLETE_PROGRESS });
});

it('finishes on the terminal acknowledgement even if the connection stays open', async () => {
	let cancelled = false;
	const response = new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{"type":"result","writes":true}\n')); }, cancel() { cancelled = true; } }), { headers: { 'content-type': 'application/x-ndjson' } });
	assert.deepEqual(await readProgressResponse(response, () => {}), { type: 'result', writes: true });
	assert.equal(cancelled, true);
});
