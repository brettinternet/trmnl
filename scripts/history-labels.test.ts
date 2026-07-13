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
      {
        recipe: "snowfall-history",
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
});
