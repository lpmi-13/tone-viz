export function compareContours(targetPoints, learnerPoints, toneId) {
  if (!learnerPoints || learnerPoints.length < 4) {
    return {
      feedback: "Pitch was unclear. Try recording in a quieter room or holding the vowel longer.",
      cues: [],
      segments: []
    };
  }

  const target = resample(targetPoints, 80);
  const learner = resample(learnerPoints, 80);
  const errors = target.map((targetPoint, index) => ({
    t: targetPoint.t,
    diff: learner[index].y - targetPoint.y,
    abs: Math.abs(learner[index].y - targetPoint.y)
  }));

  const startDiff = averageDiff(errors.slice(0, 14));
  const endDiff = averageDiff(errors.slice(-14));
  const overallDiff = averageDiff(errors);
  const targetStart = averageY(target.slice(0, 14));
  const targetEnd = averageY(target.slice(-14));
  const learnerStart = averageY(learner.slice(0, 14));
  const learnerEnd = averageY(learner.slice(-14));
  const targetDelta = targetEnd - targetStart;
  const learnerDelta = learnerEnd - learnerStart;
  const learnerMotion = amplitude(learner);
  const segments = buildSegments(errors);
  const cues = buildCues(errors, startDiff, endDiff, targetDelta, learnerDelta);
  const feedback = buildFeedback({
    toneId,
    startDiff,
    endDiff,
    overallDiff,
    targetDelta,
    learnerDelta,
    learnerMotion
  });

  return { feedback, cues, segments };
}

export function resample(points, count = 80) {
  if (!points || points.length === 0) {
    return [];
  }

  if (points.length === 1) {
    return Array.from({ length: count }, (_, index) => ({
      t: count === 1 ? 0 : index / (count - 1),
      y: points[0].y
    }));
  }

  return Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 0 : index / (count - 1);
    return { t, y: interpolateY(points, t) };
  });
}

export function interpolateY(points, t) {
  if (t <= points[0].t) {
    return points[0].y;
  }

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (t <= current.t) {
      const span = Math.max(0.0001, current.t - previous.t);
      const weight = (t - previous.t) / span;
      return previous.y * (1 - weight) + current.y * weight;
    }
  }

  return points[points.length - 1].y;
}

function buildFeedback(metrics) {
  const {
    toneId,
    startDiff,
    endDiff,
    overallDiff,
    targetDelta,
    learnerDelta,
    learnerMotion
  } = metrics;

  if (toneId === "rising") {
    if (startDiff > 0.14) {
      return "The rising tone is starting too high. Begin lower, then lift through the end.";
    }
    if (learnerDelta < targetDelta - 0.18 || endDiff < -0.14) {
      return "The rising tone started in range, but it needs a stronger rise by the end.";
    }
  }

  if (toneId === "falling") {
    if (startDiff < -0.14) {
      return "The falling tone needs a higher start before the drop.";
    }
    if (learnerDelta > targetDelta + 0.18 || endDiff > 0.14) {
      return "The falling tone stayed too high or too level. Drop more clearly after the start.";
    }
  }

  if (toneId === "high") {
    if (overallDiff < -0.14) {
      return "Keep the high tone higher in your range, with a slight lift rather than a drop.";
    }
    if (learnerDelta < -0.12) {
      return "The high tone is falling away. Hold it high or let it rise slightly.";
    }
  }

  if (toneId === "low") {
    if (overallDiff > 0.14) {
      return "Keep the low tone lower in your range and avoid lifting it too much.";
    }
    if (learnerMotion > 0.28) {
      return "The low tone should stay steadier and low; reduce the pitch movement.";
    }
  }

  if (toneId === "mid") {
    if (learnerMotion > 0.22) {
      return "The mid tone should stay level. Hold the pitch steadier through the syllable.";
    }
    if (Math.abs(overallDiff) > 0.16) {
      return overallDiff > 0
        ? "The mid tone is sitting high. Bring it closer to the middle of your range."
        : "The mid tone is sitting low. Bring it closer to the middle of your range.";
    }
  }

  if (Math.abs(startDiff) > 0.16) {
    return startDiff > 0
      ? "The contour starts too high. Lower the beginning and follow the target shape."
      : "The contour starts too low. Raise the beginning and follow the target shape.";
  }

  if (Math.abs(endDiff) > 0.16) {
    return endDiff > 0
      ? "The end sits too high compared with the target. Ease the ending downward."
      : "The end sits too low compared with the target. Lift the ending more.";
  }

  return "The contour is close enough to compare visually. Refine the highlighted region.";
}

function buildCues(errors, startDiff, endDiff, targetDelta, learnerDelta) {
  const cues = [];
  const largest = [...errors].sort((a, b) => b.abs - a.abs)[0];

  if (Math.abs(startDiff) > 0.14) {
    cues.push({
      t: 0.1,
      direction: startDiff > 0 ? "down" : "up",
      label: startDiff > 0 ? "start lower" : "start higher"
    });
  }

  if (targetDelta > 0.18 && learnerDelta < targetDelta - 0.14) {
    cues.push({ t: 0.82, direction: "up", label: "rise more" });
  }

  if (targetDelta < -0.18 && learnerDelta > targetDelta + 0.14) {
    cues.push({ t: 0.7, direction: "down", label: "drop more" });
  }

  if (Math.abs(endDiff) > 0.14) {
    cues.push({
      t: 0.9,
      direction: endDiff > 0 ? "down" : "up",
      label: endDiff > 0 ? "end lower" : "end higher"
    });
  }

  if (cues.length === 0 && largest && largest.abs > 0.16) {
    cues.push({
      t: largest.t,
      direction: largest.diff > 0 ? "down" : "up",
      label: largest.diff > 0 ? "lower here" : "lift here"
    });
  }

  return cues.slice(0, 2);
}

function buildSegments(errors) {
  const threshold = 0.17;
  const segments = [];
  let active = null;

  for (const error of errors) {
    if (error.abs >= threshold && !active) {
      active = { start: error.t, end: error.t };
    } else if (error.abs >= threshold && active) {
      active.end = error.t;
    } else if (active) {
      if (active.end - active.start > 0.04) {
        segments.push(active);
      }
      active = null;
    }
  }

  if (active && active.end - active.start > 0.04) {
    segments.push(active);
  }

  return segments.slice(0, 3);
}

function averageDiff(errors) {
  if (errors.length === 0) {
    return 0;
  }

  return errors.reduce((sum, error) => sum + error.diff, 0) / errors.length;
}

function averageY(points) {
  if (points.length === 0) {
    return 0;
  }

  return points.reduce((sum, point) => sum + point.y, 0) / points.length;
}

function amplitude(points) {
  const values = points.map((point) => point.y);
  return Math.max(...values) - Math.min(...values);
}
