(function () {
  "use strict";

  const WIDTH = 1920;
  const HEIGHT = 1080;
  const CHAMPIONS = window.WILDRIFT_CHAMPIONS || [];
  const CHAMPION_BY_ID = new Map(CHAMPIONS.map((champion) => [champion.id, champion]));

  function getSeries() {
    const exportedSeries = window.WILDRIFT_DRAFT_EXPORT?.getSeries?.();
    if (exportedSeries) return exportedSeries;

    const title = document.getElementById("draftTitle")?.textContent || "";
    let format = title.includes("BO5") ? 5 : title.includes("BO3") ? 3 : title.includes("단판") ? 1 : null;
    if (!format) return null;

    const draftTypeLabel = document.getElementById("draftTypeLabel")?.textContent || "";
    const types = draftTypeLabel.includes("친구들과") ? ["multi", "solo"] : ["solo", "multi"];
    for (const type of types) {
      const key = `wildrift-pik-series-v1:${type}:${format}`;
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const series = JSON.parse(raw);
          if (series?.format === format && Array.isArray(series.matches)) return series;
        }
      } catch (error) {
        console.error("저장된 경기 기록을 읽지 못했습니다.", error);
      }
    }
    return null;
  }

  function completedGames(series) {
    return series
      ? series.matches.filter((game) => game.status === "completed" && game.winner)
      : [];
  }

  function refreshButtons() {
    const disabled = !completedGames(getSeries()).length;
    document.getElementById("exportPngButton").disabled = disabled;
    document.getElementById("exportJpgButton").disabled = disabled;
  }

  window.WILDRIFT_EXPORT = { refreshButtons };
  refreshButtons();

  document.getElementById("exportPngButton").addEventListener("click", () => exportImage("png"));
  document.getElementById("exportJpgButton").addEventListener("click", () => exportImage("jpeg"));

  async function exportImage(type) {
    const series = getSeries();
    const games = completedGames(series);
    if (!series || !games.length) {
      refreshButtons();
      return;
    }
    try {
      await renderAndDownload(series, games, type);
    } catch (error) {
      console.error("경기 결과 이미지를 저장하지 못했습니다.", error);
      alert("경기 결과 이미지를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  }

  function loadImage(src) {
    return new Promise((resolve) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      setTimeout(() => resolve(null), 8000);
      image.src = src;
    });
  }

  function championName(id) {
    return CHAMPION_BY_ID.get(id)?.name || id || "";
  }

  function fitText(ctx, text, maxWidth, startSize, minSize, weight) {
    const value = String(text || "");
    let size = startSize;
    ctx.font = `${weight || 700} ${size}px Pretendard, Malgun Gothic, sans-serif`;
    while (size > minSize && ctx.measureText(value).width > maxWidth) {
      size -= 1;
      ctx.font = `${weight || 700} ${size}px Pretendard, Malgun Gothic, sans-serif`;
    }
    return size;
  }

  function drawText(ctx, text, x, y, maxWidth, size, color, align, weight) {
    ctx.save();
    ctx.textAlign = align || "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    fitText(ctx, text, maxWidth, size, 8, weight);
    ctx.fillText(String(text || ""), x, y, maxWidth);
    ctx.restore();
  }

  function roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function drawFallback(ctx, id, x, y, size) {
    ctx.save();
    roundRect(ctx, x, y, size, size, Math.max(6, size * 0.12));
    ctx.fillStyle = "#26374f";
    ctx.fill();
    ctx.strokeStyle = "#58708d";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#d8e5f4";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${Math.max(9, size * 0.24)}px Malgun Gothic, sans-serif`;
    ctx.fillText(String(championName(id)).slice(0, 2), x + size / 2, y + size / 2);
    ctx.restore();
  }

  function drawImage(ctx, image, id, x, y, size) {
    if (!image) {
      drawFallback(ctx, id, x, y, size);
      return;
    }
    ctx.save();
    roundRect(ctx, x, y, size, size, Math.max(6, size * 0.12));
    ctx.clip();
    const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
    const sourceWidth = size / scale;
    const sourceHeight = size / scale;
    const sourceX = (image.naturalWidth - sourceWidth) / 2;
    const sourceY = (image.naturalHeight - sourceHeight) / 2;
    ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, size, size);
    ctx.restore();
  }

  function teamIdForSide(game, side) {
    return game.sides?.[side] || (side === "blue" ? "teamA" : "teamB");
  }

  function teamName(series, side, game) {
    const teamId = teamIdForSide(game || {}, side);
    return series.teams?.[teamId]?.name ||
      series.teamNames?.[teamId === "teamA" ? "blue" : "red"] ||
      (side === "blue" ? "블루팀" : "레드팀");
  }

  function accentFor(team) {
    return team === "blue" ? "#66b9ef" : "#ed7c82";
  }

  function drawHeader(ctx, logo) {
    ctx.fillStyle = "#101a2e";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    if (logo) {
      const scale = Math.min(180 / logo.naturalWidth, 60 / logo.naturalHeight);
      const width = logo.naturalWidth * scale;
      const height = logo.naturalHeight * scale;
      ctx.drawImage(logo, 48, 28, width, height);
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#edf4ff";
    fitText(ctx, "경기 결과", 520, 42, 42, 800);
    ctx.fillText("경기 결과", 960, 60);
  }

  function drawWinnerBadge(ctx, centerX, y) {
    const width = 70;
    const height = 24;
    roundRect(ctx, centerX - width / 2, y - height / 2, width, height, 12);
    ctx.fillStyle = "#d4ac52";
    ctx.fill();
    drawText(ctx, "승리", centerX, y, width - 8, 14, "#241b08", "center", 900);
  }

  function layoutMetrics(setCount, cardHeight) {
    const targets = { 1: 154, 2: 150, 3: 145, 4: 112, 5: 88 };
    const nameSize = setCount >= 5 ? 11 : setCount === 4 ? 14 : setCount === 3 ? 17 : setCount === 2 ? 20 : 23;
    const positionSize = setCount >= 5 ? 9 : setCount === 4 ? 11 : setCount === 3 ? 14 : setCount === 2 ? 16 : 18;
    const titleReserve = setCount >= 5 ? 22 : setCount === 4 ? 24 : setCount === 3 ? 28 : setCount === 2 ? 34 : 42;
    const titleOffsetY = setCount === 5 ? 0 : 15;
    const titleBaselineOffset = Math.max(18, titleReserve / 2) + titleOffsetY;
    const contentTop = Math.max(titleReserve, titleBaselineOffset + 18);
    const bottomReserve = setCount >= 5 ? 8 : setCount === 4 ? 10 : 14;
    const nameGap = setCount >= 5 ? 4 : setCount === 4 ? 5 : 7;
    const positionGap = setCount >= 5 ? 2 : setCount === 4 ? 3 : 5;
    const available = cardHeight - contentTop - bottomReserve;
    const textHeight = nameGap + nameSize + positionGap + positionSize;
    const columnWidth = (874 - 70) / 5;
    const imageSize = Math.max(1, Math.min(targets[setCount] || 88, columnWidth - 14, available - textHeight));
    const blockHeight = imageSize + textHeight;
    return {
      imageSize,
      nameSize,
      positionSize,
      titleReserve,
      contentTop,
      bottomReserve,
      nameGap,
      positionGap,
      available,
      blockHeight
    };
  }

  function drawTeamTitle(ctx, series, team, x, y, width, game) {
    const name = teamName(series, team, game);
    const nameMaxWidth = game.winner === team ? 260 : 330;
    const nameSize = 24;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = accentFor(team);
    fitText(ctx, name, nameMaxWidth, nameSize, 11, 800);
    const measuredWidth = ctx.measureText(name).width;
    const nameCenter = game.winner === team ? x + width / 2 - 38 : x + width / 2;
    ctx.fillText(name, nameCenter, y, nameMaxWidth);
    if (game.winner === team) {
      drawWinnerBadge(ctx, nameCenter + measuredWidth / 2 + 43, y);
    }
    ctx.restore();
  }

  function drawPicks(ctx, game, team, x, y, width, size, nameSize, positionSize, nameGap, positionGap) {
    const entries = Array.isArray(game.picks?.[team]) ? game.picks[team] : [];
    const gridX = x + 58;
    const gridWidth = width - 70;
    const step = gridWidth / 5;

    for (let index = 0; index < 5; index += 1) {
      const id = entries[index];
      if (!id) continue;
      const centerX = gridX + index * step + step / 2;
      const imageX = centerX - size / 2;
      const image = window._exportImages?.get(id) || null;
      drawImage(ctx, image, id, imageX, y, size);
      drawText(
        ctx,
        championName(id),
        centerX,
        y + size + nameGap + nameSize / 2,
        step - 8,
        nameSize,
        "#edf4ff",
        "center",
        700
      );

      const position = game.positions?.[team]?.[index];
      if (position) {
        drawText(
          ctx,
          position,
          centerX,
          y + size + nameGap + nameSize + positionGap + positionSize / 2,
          step - 8,
          positionSize,
          accentFor(team),
          "center",
          800
        );
      }
    }
  }

  function drawSetCard(ctx, series, game, setCount, cardY, cardHeight, index) {
    const cardX = 70;
    const cardWidth = 1780;
    const radius = cardHeight >= 300 ? 24 : 16;

    ctx.save();
    roundRect(ctx, cardX, cardY, cardWidth, cardHeight, radius);
    ctx.fillStyle = "#15243a";
    ctx.fill();
    ctx.strokeStyle = "#314866";
    ctx.lineWidth = 2;
    ctx.stroke();

    const teamWidth = 890;
    roundRect(ctx, cardX + 8, cardY + 8, teamWidth - 16, cardHeight - 16, radius - 4);
    ctx.fillStyle = "#102840";
    ctx.fill();
    roundRect(ctx, cardX + teamWidth + 8, cardY + 8, teamWidth - 16, cardHeight - 16, radius - 4);
    ctx.fillStyle = "#351f29";
    ctx.fill();

    roundRect(ctx, cardX + 16, cardY + 12, 82, 30, 15);
    ctx.fillStyle = "#09111f";
    ctx.fill();
    drawText(ctx, `${game.gameNumber}세트`, cardX + 57, cardY + 27, 66, setCount >= 5 ? 13 : 16, "#dceaff", "center", 800);

    ctx.fillStyle = "#d8e5f4";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 ${setCount >= 5 ? 20 : setCount === 1 ? 36 : 28}px Pretendard, Malgun Gothic, sans-serif`;
    ctx.fillText("VS", 960, cardY + cardHeight / 2);

    const metrics = layoutMetrics(setCount, cardHeight - 16);
    const teamNameOffsetY = series.format === 5 && setCount === 5 ? 0 : 15;
    const titleY = cardY + Math.max(18, metrics.titleReserve / 2) + teamNameOffsetY;
    drawTeamTitle(ctx, series, "blue", cardX + 8, titleY, teamWidth - 16, game);
    drawTeamTitle(ctx, series, "red", cardX + teamWidth + 8, titleY, teamWidth - 16, game);

    const contentTop = cardY + 8 + metrics.contentTop;
    const centeredTop = contentTop + Math.max(0, (metrics.available - metrics.blockHeight) / 2);

    ["blue", "red"].forEach((team) => {
      const teamX = team === "blue" ? cardX + 8 : cardX + teamWidth + 8;
      const teamInnerWidth = teamWidth - 16;
      drawPicks(
        ctx,
        game,
        team,
        teamX,
        centeredTop,
        teamInnerWidth,
        metrics.imageSize,
        metrics.nameSize,
        metrics.positionSize,
        metrics.nameGap,
        metrics.positionGap
      );
    });
    ctx.restore();
  }

  function drawFooter(ctx, series, games) {
    const winsNeeded = series.format === 1 ? 1 : series.format === 3 ? 2 : 3;
    const score = { teamA: 0, teamB: 0 };
    games.forEach((game) => {
      if (game.winner) {
        const winnerTeamId = game.winnerTeamId || teamIdForSide(game, game.winner);
        score[winnerTeamId] += 1;
      }
    });
    const winner = score.teamA >= winsNeeded
      ? "teamA"
      : score.teamB >= winsNeeded
        ? "teamB"
        : null;

    ctx.save();
    roundRect(ctx, 80, 940, 1760, 80, 20);
    ctx.fillStyle = winner ? "#1d3150" : "#172840";
    ctx.fill();
    ctx.strokeStyle = winner ? "#d4ac52" : "#3a5575";
    ctx.lineWidth = 3;
    ctx.stroke();

    const teamAName = series.teams?.teamA?.name || series.teamNames?.blue || "블루팀";
    const teamBName = series.teams?.teamB?.name || series.teamNames?.red || "레드팀";
    const text = winner
      ? `🏆 최종 승리 · ${series.teams?.[winner]?.name || (winner === "teamA" ? teamAName : teamBName)} (${winner === "teamA" ? `${score.teamA}:${score.teamB}` : `${score.teamB}:${score.teamA}`})`
      : `진행 중 · 현재 스코어 · ${teamAName} ${score.teamA}:${score.teamB} ${teamBName}`;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#d4ac52";
    fitText(ctx, text, 1680, 32, 18, 800);
    ctx.fillText(text, 960, 980);

    ctx.restore();
  }

  async function renderAndDownload(series, games, type) {
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext("2d");

    const logo = await loadImage("assets/와일드리프트 픽! 에너지 로고.png");
    drawHeader(ctx, logo);

    const ids = new Set();
    games.forEach((game) => {
      ["blue", "red"].forEach((team) => {
        (game.picks?.[team] || []).forEach((id) => {
          if (id) ids.add(id);
        });
      });
    });
    const entries = await Promise.all([...ids].map(async (id) => {
      const champion = CHAMPION_BY_ID.get(id);
      return [id, champion?.image ? await loadImage(champion.image) : null];
    }));
    window._exportImages = new Map(entries);

    const setCount = games.length;
    const top = 120;
    const bottom = 920;
    const gap = 12;
    const cardHeight = (800 - gap * (setCount - 1)) / setCount;
    games.forEach((game, index) => {
      const cardY = top + index * (cardHeight + gap);
      drawSetCard(ctx, series, game, setCount, cardY, cardHeight, index);
    });

    drawFooter(ctx, series, games);

    const mime = type === "jpeg" ? "image/jpeg" : "image/png";
    const quality = type === "jpeg" ? 0.92 : undefined;
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (result) => result ? resolve(result) : reject(new Error("이미지 Blob 생성 실패")),
        mime,
        quality
      );
    });
    const extension = type === "jpeg" ? "jpg" : "png";
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `WILDRIFT-PIK-BO${series.format}.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
})();
