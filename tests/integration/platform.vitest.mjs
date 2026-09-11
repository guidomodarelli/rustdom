/** @file Exercises the Web API bridge in actual Vitest test execution. */
import { test, expect } from 'vitest';

test('should submit DOM FormData through a native Request without changing filenames', async () => {
  const form = new FormData();
  form.append('name', 'rustdom');
  form.append('file', new Blob(['content'], { type: 'text/plain' }), 'content.txt');
  const request = new Request('http://localhost/upload', { method: 'POST', body: form });
  const received = await request.formData();
  expect(received.get('name')).toBe('rustdom');
  expect(received.get('file').name).toBe('content.txt');
  expect(await received.get('file').text()).toBe('content');
});

test('should remove a DOM listener when a native AbortController aborts', () => {
  const button = document.createElement('button');
  const controller = new AbortController();
  let clicks = 0;
  button.addEventListener('click', () => clicks++, { signal: controller.signal });
  button.click();
  controller.abort();
  button.click();
  expect(clicks).toBe(1);
});

test('should preserve DOM FileReader while accepting Blob responses and clones', async () => {
  const file = new File(['file body'], 'body.txt', { type: 'text/plain' });
  const reader = new FileReader();
  const loaded = new Promise((resolve, reject) => {
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
  });
  reader.readAsText(file);
  expect(await loaded).toBe('file body');
  const response = new Response(file);
  expect(await response.clone().text()).toBe('file body');
  expect(await response.text()).toBe('file body');
});

test('should retain body consumption and malformed multipart errors', async () => {
  const body = new FormData();
  body.append('field', 'value');
  const request = new Request('http://localhost', { method: 'POST', body });
  expect((await request.clone().formData()).get('field')).toBe('value');
  expect((await request.formData()).get('field')).toBe('value');
  await expect(request.formData()).rejects.toThrow(TypeError);
  const malformed = new Response('invalid', { headers: { 'content-type': 'multipart/form-data; boundary=example' } });
  await expect(malformed.formData()).rejects.toThrow(TypeError);
});
