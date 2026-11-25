# Quality checklist

Run `qa_deck.py` and look at the contact sheet before delivering. A deck ships with 0 ERROR.

## Story

- [ ] Every title is a full-sentence takeaway, at most about 15 words and two lines.
- [ ] Read in order, the titles tell the whole story; the last slide asks for the decision, with owners.
- [ ] One message per slide; nothing on the slide contradicts its title.

## Numbers and sources

- [ ] Every number matches its source exactly; nothing is invented.
- [ ] Demonstration data says "Illustrative" on the slide and in the source line.
- [ ] Every content slide has a source line; estimates and assumptions are labelled as such.
- [ ] Status tags appear only where the source states the status.

## Layout

- [ ] No text overflow, off-slide shape or overlap (qa_deck ERRORs).
- [ ] No slide holds only a title and a source line; no "(cont.)" slide when cutting or merging would fit.
- [ ] Charts are native and editable, in theme colours, with readable labels (10pt minimum).
- [ ] Tables fit their placeholder; no single word breaks across lines.
- [ ] Theme fonts and colours only; no hard-coded off-theme colour.

## Delivery

- [ ] The .pptx opens and edits in PowerPoint; placeholders are filled, not floating text boxes.
- [ ] The contact sheet is attached, and limitations (fonts, estimates, pictures) are stated.
