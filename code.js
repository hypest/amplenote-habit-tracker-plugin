{
    defaultUnchecked: "🔲",
    defaultChecked: "✔",
    defaultTimesMark: "×",
  
    nums: [..."𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵"],
    toSmallNumerals(naturalNumber) {
      return [...naturalNumber+''].map(n => this.nums[(+n)]).join('');
    },
    
    checkmark(app, checked) {
      const key = "Times mark (leave empty for ×)";
      return app.settings[key] || this.defaultTimesMark;
    },
  
    markdown(count) {
      const num = this.toSmallNumerals(count);
      return `[${num}/${num} ⎹  ][^1]\n\n[^1]: [${num}/${num} ⎹  ]()\n\n    Click the button below to calculate.\n\n`;
    },
  
    startsWith: async function(app, mark) {
      // check if the footnote corresponds a checkbox.
      const floatingPattern = new RegExp(`^#*? *?\\[${mark}.*\\]`);
      const inTablePattern = new RegExp(`^\\| \\|\n\\|-\\|\n\\|\\[${mark}.*\\]`);
      return floatingPattern.test(app.context.selectionContent)
        || inTablePattern.test(app.context.selectionContent); // also check if inside a table
    },
  
    isChecked: async function(app, checked) {
      // check if the footnote corresponds to checked or unchecked state.
  
      const mark = this.checkmark(app, checked);
      return this.startsWith(app, mark);
    },
  
    insertText: {
      run: async function(app) {
        const repl = this.markdown(56);
        await app.context.replaceSelection(repl); // using replaceSelection() to parse markdown.
      }
    },
  
    habitToCalculateRegex: /(?<beforeCount>(\\\|)*?\s*?\[(\\\|)*?\s*?)(?<habitTickedCount>[𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵\/]+)(?<afterCount>(\s*?(\\\||\|)\s*?|\]\[\^.*?\]\s*?(\\\||\|)\s*?\[)(?<habitName>.*?)\]\((?<habitURL>https:\/\/www.amplenote.com\/notes\/(?<habitUUID>.*?))\))/g,
    // example6: '[𝟱𝟲/𝟱𝟲][^3]|[Ξύπνημα 6πμ](https://www.amplenote.com/notes/7645917c-faaf-11ee-a912-02d8623bad88)',
                                                                                              
    linkOption: {
      "Count last week": {
        check: async function(app, link) {
          const currentContent = await app.getNoteContent({ uuid: app.context.noteUUID });
  
          var count = 0;
          // search for habit tracker widgets in the current note
          for (const match of currentContent.matchAll(this.habitToCalculateRegex)) {
            if (match && match.groups.habitUUID) {
              count++;
            }
          }
          
          // todo: consider treating any occurance of the habit name as a checkbox if a full task or completed task
  
          return count > 0;
        },
  
        run: async function(app, link) {
          const untickedMark = "⬜";
          const tickedMark = "✅";
          const currentContent = await app.getNoteContent({ uuid: app.context.noteUUID });
  
          const counts = {};
  
          const dailyJotHandles = await app.filterNotes({ tag: "daily-jots" });
  
          // search for habit tracker widgets in the current note
          for (const match of currentContent.matchAll(this.habitToCalculateRegex)) {
            if (!match || !match.groups.habitUUID) {
              return false;
            }
  
            const checkboxInsideRegex = new RegExp(`\\[\\s*?(${untickedMark}|${tickedMark})\\s*?[^\\].]*?\\]\\(${match.groups.habitURL}.*?\\)`, "g");
            const checkboxBeforeRegex = new RegExp(`\\[(${untickedMark}|${tickedMark})\\]\\[\\^\\d*?\\]\\s*?\\[[^\\].]*?\\]\\(${match.groups.habitURL}.*?\\)`, "g");
  
            var untickedCount = 0, tickedCount = 0;
  
            const habitNoteHandle = await app.findNote({ uuid: match.groups.habitUUID });
            const backlinks = await app.getNoteBacklinks({ uuid: habitNoteHandle.uuid });
            const jotsFound = backlinks.filter(backlink => {
              return dailyJotHandles.find(jot => jot.uuid === backlink.uuid);
            });
  
            // Amplenote seems to have a bug on mobile and getNoteBacklinks can return
            //  the same note more than once so, make the list unique
            const jots = jotsFound.reduce((map, jot) => map.set(jot.uuid, jot), new Map());
            
            for (const backlink of jots.values()) {
              const refContent = await app.getNoteContent({ uuid: backlink.uuid });
              
              for (const matchInRef of refContent.matchAll(checkboxInsideRegex)) {
                matchInRef[1] == untickedMark ? untickedCount++ : tickedCount++;
              }
              for (const matchInRef of refContent.matchAll(checkboxBeforeRegex)) {
                matchInRef[1] == untickedMark ? untickedCount++ : tickedCount++;
              }
            }
            counts[match.groups.habitURL] = { tickedCount, total: tickedCount+untickedCount};
          }
          const edited = currentContent.replaceAll(this.habitToCalculateRegex,
              (match, p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, offset, string, groups) => {
                const replacement = 
                  groups.beforeCount
                  + this.toSmallNumerals(counts[groups.habitURL].tickedCount)
                  + "/"
                  + this.toSmallNumerals(counts[groups.habitURL].total)
                  + groups.afterCount;
                return replacement;
              });
          const note = await app.notes.find(app.context.noteUUID);
          await note.replaceContent(edited);
  
          // todo: consider treating any occurance of the habit name as a checkbox if a full task or completed task
        }
      }
    }
  }