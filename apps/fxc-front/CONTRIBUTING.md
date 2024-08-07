# How to contribute

## Generating PWA icons

Doc:

- [Vite PWA](https://vite-pwa-org.netlify.app/assets-generator/#pwa-minimal-icons-requirements)
- [https://dev.to/masakudamatsu/favicon-nightmare-how-to-maintain-sanity-3al7](https://dev.to/masakudamatsu/favicon-nightmare-how-to-maintain-sanity-3al7)

Tools:

- [icongen](https://cthedot.de/icongen/) to generate icons ([repo](https://github.com/cthedot/icongen))
- [maskable.app](https://maskable.app/editor) to generate the maskable icons

## Optimizing PNG

Use [this script](https://gist.github.com/longwave/9482947)

```bash
#!/bin/sh

for i in `find . -name "*.png"`; do
  pngcrush -e .png2 -rem allb -brute -reduce $i
  mv ${i}2 $i
  optipng -o7 $i
done
```
