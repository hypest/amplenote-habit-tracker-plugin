{
    defaultUnchecked: "🔲",
    defaultChecked: "✔",
    defaultHabitsTag: "habit",
    defaultDailyJotsTag: "daily-jots",
  
    _loadMoment() {
      if (this._haveLoadedMoment) return Promise.resolve(true);
     
      return new Promise(function(resolve) {
        const script = document.createElement("script");
        script.setAttribute("type", "text/javascript");
        script.setAttribute("src", "https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.30.1/moment.min.js");
        script.addEventListener("load", function() {
          this._haveLoadedMoment = true;
          resolve(true);
        });
        document.body.appendChild(script);
      });
    },
    
    nums: [..."𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵"],
    toSmallNumerals(naturalNumber) {
      return [...naturalNumber+''].map(n => this.nums[(+n)]).join('');
    },
    
    habitsTag(app) {
      const key = "The tag the habits are denoted with (leave empty for 'habit')";
      return app.settings[key] || this.defaultHabitsTag;
    },
  
    dailyJotsTag(app) {
      const key = "The daily-jot tag you are using (leave empty for 'daily-jots')";
      return app.settings[key] || this.defaultDailyJotsTag;
    },
  
    checkmark(app, checked) {
      const key = "Times mark (leave empty for ×)";
      return app.settings[key] || this.defaultTimesMark;
    },
  
    markdown(count, habit, timeSpan, habitUUID, standalone) {
      const num = this.toSmallNumerals(count);
      // return `${num}/${num} this week |`;
      if (standalone)
        return `[${num}/${num} ${timeSpan}][^1]\n\n[^1]: [${num}/${num} ${timeSpan}]()\n\n    Click the button below to refresh.\n\n`;
      else
        return `[${num}/${num} ${timeSpan} |${habit ? ` ${habit}` : ''}](https:\/\/www.amplenote.com\/notes\/${habitUUID})`;
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
  
    inTimeSpan: {
      "this week": function(dateToCheck) {
        const startOfThisWeek = moment().startOf('day').weekday(1);
        return dateToCheck.isSameOrAfter(startOfThisWeek);
      },
      "last week": function(dateToCheck) {
        const startOfThisWeek = moment().startOf('day').weekday(1);
        const startOfLastWeek = startOfThisWeek.clone().subtract(7, 'days');
        return dateToCheck.isBefore(startOfThisWeek) && dateToCheck.isSameOrAfter(startOfLastWeek);
      },
      "this month": function(dateToCheck) {
        const startOfThisMonth = moment().startOf('month');
        return dateToCheck.isSameOrAfter(startOfThisMonth);
      },
      "last month": function(dateToCheck) {
        const startOfThisMonth = moment().startOf('month');
        const startOfLastMonth = moment().subtract(1, 'months').startOf('month');
        return dateToCheck.isBefore(startOfThisMonth) && dateToCheck.isSameOrAfter(startOfLastMonth);
      }
    },
  
    insertText: {
      run: async function(app) {
        const habitHandles = await app.filterNotes({ tag: this.habitsTag(app) });
        const timeSpanOptions = Object.keys(this.inTimeSpan).reduce(
          (acc, val) => { acc.push({label: val, value: val}); return acc; }, []);
        const habitOptions = habitHandles.reduce(
          (acc, val) => { acc.push({label: val.name, value: val.uuid}); return acc; }, []);
        const result = await app.prompt("", {
          inputs: [ 
            { label: "In table? (won't use the habit tag; adjacent table cell should have it)", type: "checkbox" },
            { label: "Which time span to track?", type: "select", options: timeSpanOptions },
            { label: "Which habit to track?", type: "select", options: habitOptions },
          ] 
        });
     
        if (result) {
          const [ standalone, timeSpanOption, habitOption ] = result;
          const repl = this.markdown(
            0,
            habitOptions.find(val => val.value === habitOption).label,
            timeSpanOptions.find(val => val.value === timeSpanOption).label,
            habitOption,
            standalone);
          await app.context.replaceSelection(repl); // using replaceSelection() to parse markdown.
        }
      }
    },
  
    habitToCalculateRegex: /(?<beforeCount>(\\\|)*?\s*?\[(\\\|)*?\s*?)(?<habitTickedCount>[𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵\/]+)(?<afterCount>(\s*?(?<timeSpan>((this week)|(last week)|(this month)|(last month)))\s*?(\\\||\|)\s*?|\]\[\^.*?\]\s*?(\\\||\|)\s*?\[)(?<habitName>.*?)\]\((?<habitURL>https:\/\/www.amplenote.com\/notes\/(?<habitUUID>.*?))\))/g,
                                                                                              
    linkOption: {
      "Refresh": {
        check: async function(app, link) {
          //load momentjs early
          await this._loadMoment();
  
          const currentContent = await app.getNoteContent({ uuid: app.context.noteUUID });
  
          // search for habit tracker widgets in the current note
          // todo: consider treating any occurance of the habit name as a checkbox if a full task or completed task
          for (const match of currentContent.matchAll(this.habitToCalculateRegex)) {
            if (match && match.groups.habitUUID) {
              return true; // bail early since we found at least one.
            }
          }
        },
  
        run: async function(app, link) {
          const untickedMark = "⬜";
          const tickedMark = "✅";
          const currentContent = await app.getNoteContent({ uuid: app.context.noteUUID });
          const counts = {};
  
          const dailyJotHandles = await app.filterNotes({ tag: this.dailyJotsTag(app) });
  
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
              return dailyJotHandles.find(jot => {
                if (jot.uuid !== backlink.uuid) return false // return early if not the note we're looking for
  
                const jotDate = moment(jot.name, "MMMM Do, YYYY");
                return this.inTimeSpan[match.groups.timeSpan](jotDate);
              })
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
            counts[`${match.groups.habitURL}_${match.groups.timeSpan}`] = { tickedCount, total: tickedCount+untickedCount};
          }
  
          const edited = currentContent.replaceAll(this.habitToCalculateRegex,
              (match, p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17,
               offset, string, groups) => {
                const replacement = 
                  groups.beforeCount
                  + this.toSmallNumerals(counts[`${groups.habitURL}_${groups.timeSpan}`].tickedCount)
                  + "/"
                  + this.toSmallNumerals(counts[`${groups.habitURL}_${groups.timeSpan}`].total)
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