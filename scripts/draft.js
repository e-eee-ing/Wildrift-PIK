(() => {
  const STORAGE_PREFIX = "wildrift-pik-series-v1";
  const CHAMPIONS = window.WILDRIFT_CHAMPIONS || [];
  const IMAGE_BY_ID = new Map(CHAMPIONS.map((champion) => [champion.id, champion]));
  const KOREAN_COLLATOR = new Intl.Collator("ko");
  const FORMAT_INFO = {
    1: { label: "단판", winsNeeded: 1 },
    3: { label: "BO3", winsNeeded: 2 },
    5: { label: "BO5", winsNeeded: 3 }
  };
  const TURNS = [
    ...["blue", "red", "blue", "red", "blue", "red"].map((team) => ({ kind: "ban", team })),
    ...["blue", "red", "red", "blue", "blue", "red"].map((team) => ({ kind: "pick", team })),
    ...["red", "blue", "red", "blue"].map((team) => ({ kind: "ban", team })),
    ...["red", "blue", "blue", "red"].map((team) => ({ kind: "pick", team }))
  ];

  let selectedFormat = null;
  let selectedFearlessMode = "none";
  let draftType = "solo";
  let series = null;
  let selectedHistoryGame = null;
  let historyOpen = true;
  const POSITIONS = ["탑", "정글", "미드", "원딜", "서폿"];
  const NO_BAN_ID = "__NO_BAN__";
  const normalizeFearlessMode = (mode) =>
    mode === "soft" || mode === "hard" ? mode : "none";

  const byId = (id) => document.getElementById(id);
  const currentGame = () => series?.matches[series.currentIndex] ?? null;
  const defaultTeamName = (team) => team === "blue" ? "블루팀" : "레드팀";
  const teamIdForSide = (game, side) =>
    game?.sides?.[side] || (side === "blue" ? "teamA" : "teamB");
  const actualTeamLabel = (teamId) => series?.teams?.[teamId]?.name ||
    (teamId === "teamA" ? series?.teamNames?.blue : series?.teamNames?.red) ||
    (teamId === "teamA" ? "블루팀" : "레드팀");
  const teamLabel = (side, game = currentGame()) =>
    actualTeamLabel(teamIdForSide(game, side));
  const normalizeTeamName = (value, team) => {
    const name = typeof value === "string" ? Array.from(value.trim()).slice(0, 20).join("") : "";
    return name || defaultTeamName(team);
  };
  const makeGame = (gameNumber, sides = { blue: "teamA", red: "teamB" }) => ({
    gameNumber,
    sides: { blue: sides.blue, red: sides.red },
    bans: { blue: Array(5).fill(null), red: Array(5).fill(null) },
    picks: { blue: Array(5).fill(null), red: Array(5).fill(null) },
    positions: { blue: Array(5).fill(null), red: Array(5).fill(null) },
    winner: null,
    status: "in_progress",
    turnIndex: 0
  });

  window.show = (id) => {
    document.querySelectorAll(".screen").forEach((screen) => screen.classList.remove("active"));
    byId(id).classList.add("active");
  };

  window.continueToFormat = () => window.show("modes");

  window.selectFormat = (format) => {
    selectedFormat = Number(format);
    document.querySelectorAll(".format-card").forEach((card) => {
      card.classList.toggle("selected", Number(card.dataset.format) === selectedFormat);
    });
    byId("startSeriesButton").disabled = false;
    const saved = readSeries(selectedFormat);
    selectedFearlessMode = selectedFormat === 1 ? "none" : saved
      ? normalizeFearlessMode(saved.fearlessMode)
      : normalizeFearlessMode(selectedFearlessMode);
    updateFearlessOptions(selectedFormat === 3 || selectedFormat === 5, Boolean(saved));
    if (saved) populateTeamNameSettings(saved.teamNames);
    byId("formatHint").textContent = saved
      ? `${FORMAT_INFO[selectedFormat].label} 저장된 기록이 있습니다. 이어서 진행합니다.`
      : `${FORMAT_INFO[selectedFormat].label} 경기를 시작합니다.`;
  };

  window.startSeries = () => {
    if (!selectedFormat) return;
    const saved = readSeries(selectedFormat);
    if (saved) {
      series = saved;
    } else {
      const teamNames = readTeamNamesFromForm();
      series = {
        format: selectedFormat,
        type: draftType,
        currentIndex: 0,
        matches: [makeGame(1, { blue: "teamA", red: "teamB" })],
        teamNames,
        teamNameModes: readTeamNameModesFromForm(),
        teams: {
          teamA: { name: teamNames.blue },
          teamB: { name: teamNames.red }
        },
        nextSideChoice: "keep",
        fearlessMode: selectedFearlessMode
      };
    }
    series.fearlessMode = normalizeFearlessMode(series.fearlessMode);
    series.type = draftType;
    series.nextSideChoice = series.nextSideChoice === "swap" ? "swap" : "keep";
    saveSeries();
    selectedHistoryGame = null;
    byId("championSearch").value = "";
    render();
    window.show("draft");
  };

  window.cancelSelection = () => {
    byId("championSearch").value = "";
    render();
  };

  window.undoLastDraftSelection = () => {
    const game = currentGame();
    if (!game || game.status === "completed" || game.turnIndex <= 0 || game.turnIndex > TURNS.length) return;
    const previousTurn = TURNS[game.turnIndex - 1];
    if (!previousTurn) return;
    const collection = game[previousTurn.kind === "ban" ? "bans" : "picks"][previousTurn.team];
    for (let index = collection.length - 1; index >= 0; index -= 1) {
      if (collection[index]) {
        if (previousTurn.kind === "pick") game.positions[previousTurn.team][index] = null;
        collection[index] = null;
        game.turnIndex -= 1;
        byId("championSearch").value = "";
        saveSeries();
        render();
        return;
      }
    }
  };

  window.resetCurrentGame = () => {
    const game = currentGame();
    if (!game || game.status !== "in_progress") {
      alert("완료된 세트는 시리즈 초기화로 새로 시작할 수 있습니다.");
      return;
    }
    if (!confirm("현재 세트의 밴픽과 포지션 기록을 모두 지울까요?")) return;
    series.matches[series.currentIndex] = makeGame(game.gameNumber, game.sides);
    selectedHistoryGame = null;
    saveSeries();
    render();
  };

  window.resetSeries = () => {
    if (!series || !confirm(`${FORMAT_INFO[series.format].label} 기록을 모두 초기화할까요?`)) return;
    try {
      localStorage.removeItem(storageKey(series.format, draftType));
    } catch (error) {
      console.error("경기 기록을 초기화하지 못했습니다.", error);
      alert("경기 기록을 초기화하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.");
      return;
    }
    series = null;
    selectedFormat = null;
    selectedHistoryGame = null;
    document.querySelectorAll(".format-card").forEach((card) => card.classList.remove("selected"));
    byId("startSeriesButton").disabled = true;
    selectedFearlessMode = "none";
    updateFearlessOptions(false, false);
    window.show("modes");
    byId("formatHint").textContent = "저장된 기록을 초기화했습니다. 경기 형식을 선택해 주세요.";
    render();
  };

  window.completeCurrentGame = () => {
    const game = currentGame();
    const winner = byId("winnerSelect").value;
    if (!game || game.turnIndex < TURNS.length || !winner) return;
    game.winner = winner;
    game.winnerTeamId = teamIdForSide(game, winner);
    game.status = "completed";
    saveSeries();
    render();
  };

  window.startNextGame = () => {
    if (!series || seriesEnded() || currentGame()?.status !== "completed") return;
    const previousSides = currentGame().sides;
    const nextSides = series.nextSideChoice === "swap"
      ? { blue: previousSides.red, red: previousSides.blue }
      : { blue: previousSides.blue, red: previousSides.red };
    series.matches.push(makeGame(currentGame().gameNumber + 1, nextSides));
    series.currentIndex += 1;
    series.nextSideChoice = "keep";
    selectedHistoryGame = null;
    byId("championSearch").value = "";
    saveSeries();
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  window.toggleHistory = () => {
    historyOpen = !historyOpen;
    byId("historyContent").hidden = !historyOpen;
    byId("historyToggle").textContent = historyOpen ? "접기" : "펼치기";
    byId("historyToggle").setAttribute("aria-expanded", String(historyOpen));
  };

  byId("championSearch").addEventListener("input", renderChampions);
  byId("softFearlessCheckbox").addEventListener("change", (event) => {
    updateFearlessSelection("soft", event.currentTarget.checked);
  });
  byId("hardFearlessCheckbox").addEventListener("change", (event) => {
    updateFearlessSelection("hard", event.currentTarget.checked);
  });
  document.querySelectorAll('input[name="nextSideChoice"]').forEach((input) => {
    input.addEventListener("change", () => {
      if (!series || !["keep", "swap"].includes(input.value)) return;
      series.nextSideChoice = input.value;
      saveSeries();
    });
  });
  document.querySelectorAll(".fearless-help-button").forEach((button) => {
    button.addEventListener("click", () => {
      const help = byId(button.getAttribute("aria-controls"));
      const isOpening = help.hidden;
      document.querySelectorAll(".fearless-help").forEach((item) => { item.hidden = true; });
      document.querySelectorAll(".fearless-help-button").forEach((item) => {
        item.setAttribute("aria-expanded", "false");
      });
      help.hidden = !isOpening;
      button.setAttribute("aria-expanded", String(isOpening));
    });
  });
  document.querySelectorAll(".team-name-input").forEach((input) => {
    input.addEventListener("input", () => {
      input.value = Array.from(input.value).slice(0, 20).join("");
    });
  });
  byId("winnerSelect").addEventListener("change", () => {
    const game = currentGame();
    byId("completeGameButton").disabled = !game ||
      game.turnIndex < TURNS.length ||
      game.status === "completed" ||
      !byId("winnerSelect").value;
  });

  function storageKey(format, type) {
    return `${STORAGE_PREFIX}:${type}:${format}`;
  }

  function updateFearlessOptions(available, locked) {
    const options = byId("fearlessOptions");
    const soft = byId("softFearlessCheckbox");
    const hard = byId("hardFearlessCheckbox");
    options.hidden = !available;
    soft.disabled = !available || locked;
    hard.disabled = !available || locked;
    soft.checked = selectedFearlessMode === "soft";
    hard.checked = selectedFearlessMode === "hard";
    if (!available) {
      document.querySelectorAll(".fearless-help").forEach((help) => { help.hidden = true; });
      document.querySelectorAll(".fearless-help-button").forEach((button) => {
        button.setAttribute("aria-expanded", "false");
      });
    }
  }

  function updateFearlessSelection(mode, checked) {
    if (selectedFormat !== 3 && selectedFormat !== 5) return;
    selectedFearlessMode = checked ? mode : selectedFearlessMode === mode ? "none" : selectedFearlessMode;
    updateFearlessOptions(true, false);
  }

  function readSeries(format) {
    try {
      const types = [draftType, draftType === "solo" ? "multi" : "solo"];
      let saved = null;
      for (const type of types) {
        const raw = localStorage.getItem(storageKey(format, type));
        if (!raw) continue;
        const candidate = JSON.parse(raw);
        if (candidate?.format !== format || !Array.isArray(candidate.matches) || !candidate.matches.length) {
          throw new Error("저장된 경기 기록 형식이 올바르지 않습니다.");
        }
        saved = candidate;
        draftType = type;
        break;
      }
      if (!saved) return null;
      saved.fearlessMode = format === 1 ? "none" : normalizeFearlessMode(saved.fearlessMode);
      saved.teamNames = {
        blue: normalizeTeamName(saved.teamNames?.blue, "blue"),
        red: normalizeTeamName(saved.teamNames?.red, "red")
      };
      saved.teams = {
        teamA: { name: normalizeTeamName(saved.teams?.teamA?.name || saved.teamNames.blue, "blue") },
        teamB: { name: normalizeTeamName(saved.teams?.teamB?.name || saved.teamNames.red, "red") }
      };
      saved.nextSideChoice = saved.nextSideChoice === "swap" ? "swap" : "keep";
      saved.teamNameModes = {
        blue: saved.teamNameModes?.blue === "custom" ||
          (!saved.teamNameModes && saved.teamNames.blue !== defaultTeamName("blue")) ? "custom" : "default",
        red: saved.teamNameModes?.red === "custom" ||
          (!saved.teamNameModes && saved.teamNames.red !== defaultTeamName("red")) ? "custom" : "default"
      };
      saved.matches.forEach((game) => {
        game.sides = {
          blue: game.sides?.blue === "teamB" ? "teamB" : "teamA",
          red: game.sides?.red === "teamA" ? "teamA" : "teamB"
        };
        if (game.winner && !game.winnerTeamId) {
          game.winnerTeamId = teamIdForSide(game, game.winner);
        }
        game.positions = ["blue", "red"].reduce((positions, team) => {
          const used = new Set();
          positions[team] = Array.from({ length: 5 }, (_, index) => {
            const position = game.positions?.[team]?.[index];
            if (!game.picks?.[team]?.[index] || !POSITIONS.includes(position) || used.has(position)) return null;
            used.add(position);
            return position;
          });
          return positions;
        }, {});
      });
      return saved;
    } catch (error) {
      console.error("경기 기록을 불러오지 못했습니다.", error);
      alert("저장된 경기 기록을 불러오지 못했습니다. 기록을 초기화한 뒤 다시 시도해 주세요.");
      return null;
    }
  }

  function saveSeries() {
    if (!series) return;
    try {
      localStorage.setItem(storageKey(series.format, draftType), JSON.stringify(series));
    } catch (error) {
      console.error("경기 기록을 저장하지 못했습니다.", error);
      alert("경기 기록을 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.");
    }
  }

  function seriesScore() {
    return series.matches.reduce((score, game) => {
      if (game.status === "completed" && game.winner) {
        const winnerId = game.winnerTeamId || teamIdForSide(game, game.winner);
        score[winnerId] += 1;
      }
      return score;
    }, { teamA: 0, teamB: 0 });
  }

  function seriesEnded() {
    if (!series) return false;
    const score = seriesScore();
    return score.teamA >= FORMAT_INFO[series.format].winsNeeded ||
      score.teamB >= FORMAT_INFO[series.format].winsNeeded;
  }

  function readTeamNamesFromForm() {
    const readName = (team) => normalizeTeamName(byId(`${team}TeamName`).value, team);
    return { blue: readName("blue"), red: readName("red") };
  }

  function readTeamNameModesFromForm() {
    return ["blue", "red"].reduce((modes, team) => {
      modes[team] = byId(`${team}TeamName`).value.trim() ? "custom" : "default";
      return modes;
    }, {});
  }

  function populateTeamNameSettings(names) {
    ["blue", "red"].forEach((team) => {
      byId(`${team}TeamName`).value = normalizeTeamName(names?.[team], team);
    });
  }

  function championName(id) {
    if (id === NO_BAN_ID) return "NO BAN";
    return IMAGE_BY_ID.get(id)?.name || id || "";
  }

  function restrictedPickIds(team) {
    const restricted = new Set();
    if (!series || series.fearlessMode === "none") return restricted;
    const currentTeamId = teamIdForSide(currentGame(), team);

    series.matches.slice(0, series.currentIndex).forEach((game) => {
      if (game.status !== "completed") return;
      ["blue", "red"].forEach((previousSide) => {
        const sameTeam = teamIdForSide(game, previousSide) === currentTeamId;
        if (series.fearlessMode === "soft" && !sameTeam) return;
        (game.picks?.[previousSide] || []).forEach((championId) => {
          if (championId && championId !== NO_BAN_ID) restricted.add(championId);
        });
      });
    });
    return restricted;
  }

  function render() {
    if (!series) return;
    const game = currentGame();
    const turn = game.turnIndex < TURNS.length ? TURNS[game.turnIndex] : null;
    const done = game.status === "completed";
    const score = seriesScore();
    const winner = score.teamA >= FORMAT_INFO[series.format].winsNeeded ? "teamA"
      : score.teamB >= FORMAT_INFO[series.format].winsNeeded ? "teamB" : null;

    byId("draftTypeLabel").textContent = "밴픽 진행";
    byId("draftTitle").textContent = `${FORMAT_INFO[series.format].label} · ${game.gameNumber}세트`;
    byId("blueTeamTitle").textContent = `🔵 ${teamLabel("blue")}`;
    byId("redTeamTitle").textContent = `🔴 ${teamLabel("red")}`;
    byId("winnerSelect").querySelector('[value="blue"]').textContent =
      `${teamLabel("blue")} (블루 진영 · 선픽)`;
    byId("winnerSelect").querySelector('[value="red"]').textContent =
      `${teamLabel("red")} (레드 진영)`;
    byId("undoDraftButton").disabled = done || game.turnIndex <= 0;
    byId("turnStatus").textContent = done
      ? "세트 결과가 저장되었습니다. 이전 기록 패널에서 상세 내용을 확인할 수 있습니다."
      : turn
        ? `현재 차례: ${teamLabel(turn.team)} · ${turn.kind === "ban" ? "밴" : "픽"} ${turn.kind === "ban" ? game.bans[turn.team].filter(Boolean).length + 1 : game.picks[turn.team].filter(Boolean).length + 1}`
        : "밴픽 완료 · 승리 팀을 선택해 세트 결과를 기록해 주세요.";
    byId("seriesStatus").textContent = series.format === 1
      ? `단일 경기 · ${done ? `승리: ${teamLabel(game.winner, game)}` : "진행 중"}`
      : `시리즈 ${game.gameNumber}/${series.format}세트 · ${actualTeamLabel("teamA")} ${score.teamA}승 : ${score.teamB}승 ${actualTeamLabel("teamB")}`;
    renderDraftSlots(game, turn, done);
    renderChampions();
    renderResult();
    renderHistory();
    if (window.WILDRIFT_EXPORT) window.WILDRIFT_EXPORT.refreshButtons();
    const winnerBox = byId("seriesWinner");
    winnerBox.hidden = !winner;
    winnerBox.textContent = winner ? `시리즈 종료 · ${actualTeamLabel(winner)} 최종 승리` : "";
    const showNextGameSettings = done && !winner && series.format !== 1;
    byId("nextGameSettings").hidden = !showNextGameSettings;
    document.querySelectorAll('input[name="nextSideChoice"]').forEach((input) => {
      input.checked = (series.nextSideChoice || "keep") === input.value;
    });
  }

  function renderDraftSlots(game, turn, done) {
    ["blue", "red"].forEach((team) => {
      ["ban", "pick"].forEach((kind) => {
        const container = byId(`${team}${kind === "ban" ? "Bans" : "Picks"}`);
        const entries = game[kind === "ban" ? "bans" : "picks"][team];
        container.replaceChildren();
        entries.forEach((championId, index) => {
          const wrapper = kind === "pick" ? document.createElement("div") : null;
          if (wrapper) wrapper.className = "pick-slot-wrap";
          const button = document.createElement("button");
          button.className = `slot draft-slot ${kind}-slot${championId ? " filled" : ""}`;
          button.type = "button";
          button.disabled = Boolean(championId) || done || !turn ||
            turn.kind !== kind || turn.team !== team || index !== entries.filter(Boolean).length;
          button.classList.toggle("current-turn", !button.disabled);
          const slotName = `${kind === "ban" ? "BAN" : "PICK"}-${index + 1}`;
          button.setAttribute("aria-label", `${teamLabel(team)} ${slotName}${championId ? `: ${championName(championId)}` : ""}`);
          if (championId) appendChampion(button, championId);
          else button.textContent = slotName;
          if (!button.disabled) {
            button.addEventListener("click", () => byId("championSearch").focus());
          }
          if (wrapper) {
            wrapper.appendChild(button);
            if (championId) {
              const positionSelect = document.createElement("select");
              positionSelect.className = "position-select";
              positionSelect.setAttribute("aria-label", `${teamLabel(team)} PICK-${index + 1} 포지션`);
              positionSelect.title = "같은 팀에서 이미 선택한 포지션은 다시 선택할 수 없습니다.";
              const placeholder = document.createElement("option");
              placeholder.value = "";
              placeholder.textContent = "포지션";
              positionSelect.appendChild(placeholder);
              POSITIONS.forEach((position) => {
                const option = document.createElement("option");
                option.value = position;
                option.textContent = position;
                option.disabled = game.positions[team].some((selected, otherIndex) =>
                  otherIndex !== index && selected === position
                );
                positionSelect.appendChild(option);
              });
              positionSelect.value = game.positions[team][index] || "";
              positionSelect.disabled = done;
              positionSelect.addEventListener("change", () => {
                const position = positionSelect.value || null;
                if (position && game.positions[team].some((selected, otherIndex) =>
                  otherIndex !== index && selected === position
                )) {
                  alert("같은 팀에서 이미 선택한 포지션입니다.");
                  positionSelect.value = game.positions[team][index] || "";
                  return;
                }
                game.positions[team][index] = position;
                saveSeries();
                render();
              });
              wrapper.appendChild(positionSelect);
            }
            container.appendChild(wrapper);
          } else {
            container.appendChild(button);
          }
        });
      });
    });
    const nextTurn = game.turnIndex < TURNS.length ? TURNS[game.turnIndex] : null;
    byId("pickerHint").textContent = done ? "완료된 세트는 읽기 전용입니다."
        : nextTurn ? `${teamLabel(nextTurn.team, game)} ${nextTurn.kind === "ban" ? "밴" : "픽"} 챔피언을 선택해 주세요.`
          : "밴픽이 완료되었습니다.";
  }

  function appendChampion(container, championId) {
    if (championId === NO_BAN_ID) {
      const icon = document.createElement("span");
      icon.className = "no-ban-icon";
      icon.setAttribute("aria-hidden", "true");
      container.appendChild(icon);
      const name = document.createElement("span");
      name.textContent = "NO BAN";
      container.appendChild(name);
      return;
    }
    const champion = IMAGE_BY_ID.get(championId);
    if (champion) {
      container.appendChild(createChampionImage(champion));
    }
    const name = document.createElement("span");
    name.textContent = championName(championId);
    container.appendChild(name);
  }

  function createChampionImage(champion) {
    const image = document.createElement("img");
    image.src = champion.image;
    image.alt = "";
    image.loading = "lazy";
    image.addEventListener("error", () => image.remove(), { once: true });
    return image;
  }

  function renderChampions() {
    const grid = byId("championGrid");
    if (!grid) return;
    grid.replaceChildren();
    const game = currentGame();
    if (!game) return;
    const query = byId("championSearch").value.trim().toLocaleLowerCase("ko");
    const usedInDraft = new Set(
      [...game.bans.blue, ...game.bans.red, ...game.picks.blue, ...game.picks.red]
        .filter((entry) => entry && entry !== NO_BAN_ID)
    );
    const kind = game.turnIndex < TURNS.length ? TURNS[game.turnIndex].kind : null;
    const locked = game.status === "completed" || !kind;
    const turn = kind ? TURNS[game.turnIndex] : null;
    const fearlessRestricted = kind === "pick" && turn
      ? restrictedPickIds(turn.team)
      : new Set();
    const matches = CHAMPIONS
      .filter((champion) => champion.name.toLocaleLowerCase("ko").includes(query))
      .sort((a, b) => KOREAN_COLLATOR.compare(a.name, b.name));
    byId("championGrid").setAttribute("aria-busy", "false");
    if (kind === "ban" && "no ban".includes(query)) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "champion-option";
      button.disabled = locked;
      button.setAttribute("aria-label", "NO BAN");
      const icon = document.createElement("span");
      icon.className = "no-ban-icon";
      icon.setAttribute("aria-hidden", "true");
      const name = document.createElement("span");
      name.textContent = "NO BAN";
      button.append(icon, name);
      button.addEventListener("click", () => selectChampion(NO_BAN_ID));
      grid.appendChild(button);
    }
    if (!matches.length && !(kind === "ban" && "no ban".includes(query))) {
      const empty = document.createElement("p");
      empty.className = "small empty-state";
      empty.textContent = "검색 결과가 없습니다.";
      grid.appendChild(empty);
      return;
    }
    matches.forEach((champion) => {
      const isFearlessRestricted = fearlessRestricted.has(champion.id);
      const unavailable = locked || usedInDraft.has(champion.id) || isFearlessRestricted;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "champion-option";
      button.disabled = unavailable;
      button.setAttribute(
        "aria-label",
        `${champion.name}${isFearlessRestricted ? " · 피어리스 제한" : usedInDraft.has(champion.id) ? " · 이미 밴 또는 픽됨" : ""}`
      );
      if (isFearlessRestricted) button.title = "피어리스 제한";
      const image = createChampionImage(champion);
      const name = document.createElement("span");
      name.textContent = champion.name;
      button.append(image, name);
      if (isFearlessRestricted) {
        const restriction = document.createElement("span");
        restriction.className = "fearless-restriction";
        restriction.textContent = "피어리스 제한";
        button.appendChild(restriction);
      }
      button.addEventListener("click", () => selectChampion(champion.id));
      grid.appendChild(button);
    });
  }

  function selectChampion(championId) {
    const game = currentGame();
    if (!game || game.status !== "in_progress") return;
    const turn = TURNS[game.turnIndex];
    if (!turn) return;
    if (championId === NO_BAN_ID) {
      if (turn.kind !== "ban") return;
    }
    if (turn.kind === "pick" && restrictedPickIds(turn.team).has(championId)) return;
    const collection = game[turn.kind === "ban" ? "bans" : "picks"][turn.team];
    if (championId !== NO_BAN_ID &&
      [...game.bans.blue, ...game.bans.red, ...game.picks.blue, ...game.picks.red].includes(championId)) return;
    const slot = collection.findIndex((entry) => !entry);
    if (slot < 0) return;
    collection[slot] = championId;
    game.turnIndex += 1;
    saveSeries();
    render();
  }

  function renderResult() {
    const game = currentGame();
    if (!game) return;
    const completedDraft = game.turnIndex >= TURNS.length;
    byId("winnerSelect").disabled = !completedDraft || game.status === "completed";
    byId("winnerSelect").value = game.winner || "";
    byId("completeGameButton").disabled = !completedDraft || game.status === "completed" || !byId("winnerSelect").value;
    byId("completeGameButton").hidden = game.status === "completed";
    byId("resultHint").textContent = game.status === "completed"
      ? `기록 완료 · 승리: ${teamLabel(game.winner, game)}`
      : completedDraft ? "승리 팀을 선택하고 세트 결과를 기록해 주세요."
        : "밴픽 10회와 픽 10회를 마치면 결과를 기록할 수 있습니다.";
  }

  function renderHistory() {
    const list = byId("historyList");
    list.replaceChildren();
    const completed = series.matches.filter((game) => game.status === "completed");
    if (!completed.length) {
      const empty = document.createElement("p");
      empty.className = "small";
      empty.textContent = "완료된 세트 기록이 없습니다.";
      list.appendChild(empty);
    }
    completed.forEach((game) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "history-banner";
      button.classList.toggle("selected", selectedHistoryGame === game.gameNumber);
      button.innerHTML = "";
      const number = document.createElement("strong");
      number.textContent = `${game.gameNumber}세트`;
      const result = document.createElement("span");
      result.textContent = `${teamLabel(game.winner, game)} 승리`;
      button.append(number, result);
      button.addEventListener("click", () => {
        selectedHistoryGame = selectedHistoryGame === game.gameNumber ? null : game.gameNumber;
        renderHistory();
      });
      list.appendChild(button);
    });
    const detail = byId("historyDetail");
    detail.replaceChildren();
    const selected = completed.find((game) => game.gameNumber === selectedHistoryGame);
    if (selected) renderHistoryDetail(detail, selected);
    else {
      const hint = document.createElement("p");
      hint.className = "small";
      hint.textContent = "세트 배너를 선택하면 상세 기록을 확인할 수 있습니다.";
      detail.appendChild(hint);
    }
  }

  function renderHistoryDetail(container, game) {
    const title = document.createElement("h4");
    title.textContent = `${game.gameNumber}세트 상세 기록 · ${teamLabel(game.winner, game)} 승리`;
    container.appendChild(title);
    ["blue", "red"].forEach((team) => {
      const block = document.createElement("section");
      block.className = "history-team";
      const heading = document.createElement("h5");
      heading.textContent = `${teamLabel(team, game)} · ${team === "blue" ? "블루 진영" : "레드 진영"}`;
      block.appendChild(heading);
      const banRow = document.createElement("p");
      const banValues = document.createElement("span");
      banValues.textContent = game.bans[team].map((entry) => {
        if (!entry) return "미기록";
        return entry === NO_BAN_ID ? "[/]" : championName(entry);
      }).join(" · ");
      const banStrong = document.createElement("strong");
      banStrong.textContent = "밴: ";
      banRow.append(banStrong, banValues);
      block.appendChild(banRow);

      const pickRow = document.createElement("p");
      const pickValues = document.createElement("span");
      const positions = game.positions?.[team];
      pickValues.textContent = game.picks[team].map((entry, index) => {
        if (!entry) return "미기록";
        const name = championName(entry);
        const position = Array.isArray(positions) ? positions[index] : null;
        return position && POSITIONS.includes(position) ? `${name}(${position})` : name;
      }).join(" · ");
      const pickStrong = document.createElement("strong");
      pickStrong.textContent = "픽: ";
      pickRow.append(pickStrong, pickValues);
      block.appendChild(pickRow);
      container.appendChild(block);
    });
  }

  window.WILDRIFT_DRAFT_EXPORT = {
    getSeries: () => series ? JSON.parse(JSON.stringify(series)) : null
  };
})();
