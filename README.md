# Language Playground

A bunch of WASM fun.

## Local development

Run a local static server with auto-restart via `nodemon`:

```bash
npm run dev
```

Default URL: `http://127.0.0.1:5500`

## To-do

- [ ] **Python**
    - [ ] Add Python examples
    - [ ] Option to load minimal or full version. We may need to provide an interface to load selected modules listed [here](https://pyodide.org/en/stable/usage/downloading-and-deploying.html#additional-files-in-pyodide-0-29-3-tar-bz2). One option could be `micropip`.
    - [ ] Stating which modules are [supported](https://pyodide.org/en/stable/usage/wasm-constraints.html) in this WASM version
- [ ] **TypeScript**
    - [ ] Add TypeScript examples
        - basic DSA examples?
        - Promise
        - JSX examples?
    - [ ] Compile error for TypeScript editor
    - [ ] `fetch` not working in async/await example ([example API endpoint](https://sampleapis.com/api-list/beers))
    - [ ] `console.clear()` or `table()` is not supported (thought is printed in the console nevertheless)
- [x] Use local build instead of fetching remote Pydiode resources
- [x] Detect window resize and push the windows that exceeds the boundary to the edge accordingly.
