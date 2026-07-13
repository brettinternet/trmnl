import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const recipeRoot = join(import.meta.dir, "..", "larapaper");

const readTemplate = async (recipe: string): Promise<string> =>
  readFile(join(recipeRoot, recipe, "src/full.liquid"), "utf8");

describe("history chart label direction", () => {
  test("keeps low extrema below their points and high extrema above", async () => {
    const expectations = [
      {
        recipe: "air-quality-history",
        labels: ["valley_one_label_y", "valley_two_label_y"],
        pointPrefix: ["valley_one_y", "valley_two_y"],
        offset: "plus: label_below_gap",
      },
      {
        recipe: "air-quality-history",
        labels: ["peak_one_label_y", "peak_two_label_y", "peak_three_label_y"],
        pointPrefix: ["peak_one_y", "peak_two_y", "peak_three_y"],
        offset: "minus: label_gap",
      },
      {
        recipe: "weather-history",
        labels: [
          "peak_low_label_y",
          "autumn_valley_label_y",
          "spring_valley_label_y",
        ],
        pointPrefix: ["peak_low_y", "autumn_valley_y", "spring_valley_y"],
        offset: "plus: label_below_gap",
      },
      {
        recipe: "weather-history",
        labels: ["peak_high_label_y", "autumn_peak_label_y", "spring_peak_label_y"],
        pointPrefix: ["peak_high_y", "autumn_peak_y", "spring_peak_y"],
        offset: "minus: label_gap",
      },
      {
        recipe: "rainfall-history",
        labels: ["peak_one_label_y", "peak_two_label_y", "peak_three_label_y"],
        pointPrefix: ["peak_one_y", "peak_two_y", "peak_three_y"],
        offset: "minus: label_gap",
      },
    ];

    for (const expectation of expectations) {
      const source = await readTemplate(expectation.recipe);
      for (let i = 0; i < expectation.labels.length; i += 1) {
        expect(source).toContain(
          `{% assign ${expectation.labels[i]} = ${expectation.pointPrefix[i]} | ${expectation.offset} %}`,
        );
      }
    }
  });
  test("labels thresholded historical snow-season boundaries", async () => {
    const source = await readTemplate("snowfall-history");
    expect(source).not.toContain("peak_one");
    expect(source).not.toContain("peak_two");
    expect(source).not.toContain("peak_three");

    expect(source).toContain(
      "{% if snowfall_value >= snowy_threshold %}",
    );
    expect(source).toContain(
      "{% if first_snow_index < 0 %}{% assign first_snow_index = i %}{% endif %}",
    );
    expect(source).toContain("{% assign last_snow_index = i %}");
    expect(source).toContain(
      "{% if first_snow_index >= 0 and last_snow_index >= 0 %}",
    );
    expect(source).toContain(
      "First snow · {{ data.daily.time[first_snow_index]",
    );
    expect(source).toContain(
      "Last snow · {{ data.daily.time[last_snow_index]",
    );
    expect(source).toContain(
      "{% assign first_snow_label_y = plot_bottom | plus: season_label_gap %}",
    );
    expect(source).toContain(
      "{% assign last_snow_label_y = plot_bottom | plus: season_label_gap %}",
    );
    expect(source).toContain(
      '{% assign first_snow_label_anchor = "start" %}',
    );
    expect(source).toContain(
      '{% assign last_snow_label_anchor = "end" %}',
    );
  });
});
