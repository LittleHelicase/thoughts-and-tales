# Tiny Tales

A simple Hugo site for sharing stories—short or long.

## Getting Started

### Create a New Tale

To create a new tale, run:

```bash
hugo new tales/your-tale-name.md
```

This will create a new file in `content/tales/` with the proper front matter. Then just start writing your story!

### Preview Your Site

Start the Hugo development server:

```bash
hugo server
```

Then open [http://localhost:1313](http://localhost:1313) in your browser.

### Build for Production

To generate the static site:

```bash
hugo
```

The output will be in the `public/` directory.

## Structure

- `content/tales/` - All your tales go here
- `themes/tales-theme/` - The theme files (layouts, styles)
- `hugo.toml` - Site configuration

## Writing Tales

Tales are written in Markdown. You can use all standard Markdown features:

- **Bold** and *italic* text
- Headers
- Lists
- Links
- And more!

The first paragraph of your tale will be used as the summary on the home page.


