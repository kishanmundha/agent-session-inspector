/** Plain-text tables and styling for the terminal reports. */

/**
 * Rules and charts are drawn for a person at a terminal. Piped into grep or
 * awk, a table is its header and one line per row, nothing else.
 */
const TTY = Boolean(process.stdout.isTTY);
const COLOR = TTY && !process.env.NO_COLOR;

const style = (code: number) => (text: string) => (COLOR ? `\x1b[${code}m${text}\x1b[0m` : text);
export const bold = style(1);
export const dim = style(2);

export interface Column {
  header: string;
  align?: "left" | "right";
  /** Longest a cell may be before it is cut with an ellipsis. */
  max?: number;
}

function clip(text: string, max?: number) {
  return max && text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Rows under a header, columns padded to their widest cell. `footer` is set
 * off by a rule, for totals.
 */
export function table(columns: Column[], rows: string[][], footer?: string[]): string {
  const body = rows.map((row) => row.map((cell, i) => clip(cell, columns[i].max)));
  const all = [columns.map((c) => c.header), ...body, ...(footer ? [footer] : [])];
  const widths = columns.map((_, i) => Math.max(...all.map((row) => row[i].length)));
  const line = (cells: string[]) =>
    cells
      .map((cell, i) =>
        columns[i].align === "right" ? cell.padStart(widths[i]) : cell.padEnd(widths[i]),
      )
      .join("  ")
      .trimEnd();
  // A column without a header holds a chart, which needs no rule.
  const rule = dim(
    widths
      .map((w, i) => (columns[i].header ? "─" : " ").repeat(w))
      .join("  ")
      .trimEnd(),
  );

  const out = [bold(line(all[0])), rule, ...body.map(line)];
  if (footer) out.push(rule, bold(line(footer)));
  return out.filter((row) => TTY || row !== rule).join("\n");
}

/** A bar scaled against the largest value in its column, to an eighth of a cell. */
export function bar(value: number, max: number, width = 16): string {
  if (!TTY || max <= 0 || value <= 0) return "";
  const eighths = Math.max(1, Math.round((value / max) * width * 8));
  return "█".repeat(eighths >> 3) + ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"][eighths & 7];
}

/** Label and value pairs laid out in two columns, for headline numbers. */
export function facts(pairs: [string, string][]): string {
  const half = Math.ceil(pairs.length / 2);
  const cell = (column: [string, string][], row: number) => {
    const labelWidth = Math.max(...column.map(([label]) => label.length));
    const valueWidth = Math.max(...column.map(([, value]) => value.length));
    const pair = column[row];
    if (!pair) return "";
    return `${dim(pair[0].padEnd(labelWidth))}  ${bold(pair[1].padEnd(valueWidth))}`;
  };
  const left = pairs.slice(0, half);
  const right = pairs.slice(half);
  return left.map((_, row) => `  ${cell(left, row)}    ${cell(right, row)}`.trimEnd()).join("\n");
}
