const R = require('ramda');
const db = require('better-sqlite3')('KoboReader.sqlite');
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
    }
    return row;
  })
);

// TODO: Refactor this later
const convertToMarkdown = R.map(book => {
  const firstNote = book[0];
  let markdown = `---
title: ${firstNote.title}
author: ${firstNote.author}
---

# *${firstNote.title}* by ${firstNote.author}`;

  book.forEach((note, idx) => {
    markdown += `\n\n### ${note.annotation ? 'Note' : 'Highlight'}

${(note.chapterProgress * 100).toFixed(5)}%

> ${note.highlight.replace('\n', '\n> ')}`;

    if (note.annotation) {
      markdown += `\n\n**Comments**: ${note.annotation}`;
    }
  });

  return markdown;
});

const writeToFiles = R.compose(
  // TODO: Refactor this later
  R.map(([title, md]) =>
    writeFileSync(`${title.split(' ').join('-').toLowerCase()}.md`, md)
  ),
  R.toPairs
);

const execute = R.compose(writeToFiles, convertToMarkdown, groupByBooks);

execute(rows);
