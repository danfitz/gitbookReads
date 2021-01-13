const R = require('ramda');

try {
  const db = require('better-sqlite3')(
    '/Volumes/KOBOeReader/.kobo/KoboReader.sqlite'
  );
  const { writeFileSync } = require('fs');

  const rows = db
    .prepare(
      `
        SELECT
          B.Text as highlight,
          B.Annotation as annotation,
          B.DateCreated as dateCreated,
          B.ChapterProgress as chapterProgress,
          C.Title as title,
          C.Attribution as author
        FROM Bookmark as B
        LEFT JOIN content as C ON B.VolumeID = C.ContentID
        WHERE Text != ?
        ORDER BY title, chapterProgress
      `
    )
    .all('null');

  const groupByBooks = R.compose(
    R.groupBy(R.prop('title')),
    // TODO: Refactor this later
    R.map(row => {
      if (/\n[ \t]{2,}/g.test(row.highlight)) {
        row.highlight = row.highlight.replace(/\n[ \t]{2,}/g, ' ').trim();
      }
      if (row.annotation) {
        row.annotation = row.annotation.trim();
        row.isHeading = /^#{1,}$/.test(row.annotation);
      }
      return row;
    })
  );

  // TODO: Refactor this later
  const convertToMarkdown = R.map(book => {
    const firstNote = book[0];
    let markdown = `---
title: "${firstNote.title}"
author: "${firstNote.author}"
---
  
# *${firstNote.title}*
\`Author: ${firstNote.author}\``;

    book.forEach((note, idx) => {
      if (note.isHeading) {
        markdown += `\n\n${note.annotation} ${note.highlight.replace('\n', ' ')}`;
      } else {
        markdown += `\n\n**_${note.annotation ? 'Note' : 'Highlight'}_**
  
${(note.chapterProgress * 100).toFixed(5)}%
  
> ${note.highlight.replace('\n', '\n> ')}`;

        if (note.annotation) {
          markdown += `\n\n**Comments**: ${note.annotation}`;
        }
      }
    });

    return markdown;
  });

  const mdFilename = title => `${
    title
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()']/g, "")
      .split(' ')
      .join('-')
      .toLowerCase()
  }.md`;

  const writeToFiles = R.compose(
    // TODO: Refactor this later
    R.map(
      R.compose(
        ([title, mdText]) => writeFileSync(mdFilename(title), mdText),
        R.tap(([title]) => console.log(`Creating file: ${mdFilename(title)}`))
      )
    ),
    R.toPairs
  );

  const execute = R.compose(writeToFiles, convertToMarkdown, groupByBooks);

  execute(rows);
} catch (error) {
  console.log(
    'Please ensure your Kobo e-reader is connected to your Mac. (This app assumes a Mac as well.)'
  );
}
