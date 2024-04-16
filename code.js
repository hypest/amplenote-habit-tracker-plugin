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
      return `[(${num} ✔)][^1]\n\n[^1]: [(${num} ✔)]()\n\n    Click the button below to calculate.\n\n`;
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
  
    linkOption: {
      "Count last week": {
        check: async function(app, link) {
          const untickedMark = "⬜";
          const tickedMark = "✅";
          const habitToCalculateRegex = /\[\([𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵]*? ✔\)]\[\^.*?\]\s*?\[(.*?)\]\((https:\/\/www.amplenote.com\/notes\/(.*?))\)/g;
  
          const currentContent = await app.getNoteContent({ uuid: app.context.noteUUID });
  
          for (const match of currentContent.matchAll(habitToCalculateRegex)) {
            const habitUUID = match[3];
  
            if (habitUUID) {
              const habitURL = match[2];
              const checkboxInsideRegex = new RegExp(`\\[\\s*?(${untickedMark}|${tickedMark})\\s*?[^\\].]*?\\]\\(${habitURL}.*?\\)`, "g");
              const checkboxBeforeRegex = new RegExp(`\\[(${untickedMark}|${tickedMark})\\]\\[\\^\\d*?\\]\\s*?\\[[^\\].]*?\\]\\(${habitURL}.*?\\)`, "g");
    
              var untickedCount=0, tickedCount=0;
  
              const noteHandle = await app.findNote({ uuid: habitUUID });
              
              const backlinks = await app.getNoteBacklinks({ uuid: habitUUID });
              for (const backlink of backlinks) {
                const refContent = await app.getNoteContent({ uuid: backlink.uuid });
                // const example4 = '[⬜️ Ξύπνημα 6πμ](https://www.amplenote.com/notes/7645917c-faaf-11ee-a912-02d8623bad88)';
                // const example5 = '[✅][^14] [Ξύπνημα 6πμ](https://www.amplenote.com/notes/7645917c-faaf-11ee-a912-02d8623bad88)';
                
                debugger;
  
                for (const matchInRef of refContent.matchAll(checkboxInsideRegex)) {
                  matchInRef[1] == untickedMark ? untickedCount++ : tickedCount++;
                  debugger;
                }
                for (const matchInRef of refContent.matchAll(checkboxBeforeRegex)) {
                  matchInRef[1] == untickedMark ? untickedCount++ : tickedCount++;
                  debugger;
                }
              }
              console.log(`${noteHandle.name} ticked ${tickedCount}/${tickedCount+untickedCount}`);
            }
          }
          
          // todo: consider treating any occurance of the habit name as a checkbox if a full task or completed task
          debugger;
        },
  
        run: async function(app, link) {
          
        }
      }
    }
  }