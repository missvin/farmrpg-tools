import { describe, expect, it, vi } from 'vitest';

import {
  extractBuddyRecipeCandidates,
  extractBuddyRecipePage,
  toBuddyRecipeExtractionReviewCsv,
  toBuddyRecipeExtractionSummaryCsv,
} from '../../scripts/lib/buddyRecipeExtract.mjs';

describe('buddyRecipeExtract', () => {
  it('extracts a craft recipe and used-in rows from heading-based sections', () => {
    const result = extractBuddyRecipePage(
      {
        itemName: 'Red Twine',
        canonicalKey: 'red twine',
        generatedBuddySlug: 'red-twine',
        candidateBuddyUrl: 'https://buddy.farm/i/red-twine/',
      },
      `
        <html>
          <head><title>Red Twine</title></head>
          <body>
            <h3 id="recipe">Recipe</h3>
            <div class="bf-list-big-line bf-list-shrink-key list-group list-group-flush">
              <div class="d-flex w-100 justify-content-between gap-4 css-0 list-group-item">
                <a href="/i/red-dye/">
                  <div class="bf-list-line-one bf-list-line-one-allow-big css-12tra1i">Red Dye</div>
                  <div class="bf-list-line-two"></div>
                  <span class="bf-list-value d-flex justify-content-end css-ln8i3o">1</span>
                </a>
              </div>
              <div class="d-flex w-100 justify-content-between gap-4 css-0 list-group-item">
                <a href="/i/twine/">
                  <div class="bf-list-line-one bf-list-line-one-allow-big css-12tra1i">Twine</div>
                  <div class="bf-list-line-two"></div>
                  <span class="bf-list-value d-flex justify-content-end css-ln8i3o">1</span>
                </a>
              </div>
            </div>
            <h3>Used In</h3>
            <div class="bf-list-big-line bf-list-shrink-key list-group list-group-flush">
              <div class="d-flex w-100 justify-content-between gap-4 css-0 list-group-item">
                <a href="/i/rucksack/">
                  <div class="bf-list-line-one bf-list-line-one-allow-big css-12tra1i">Rucksack</div>
                  <div class="bf-list-line-two"></div>
                  <span class="bf-list-value d-flex justify-content-end css-ln8i3o">4</span>
                </a>
              </div>
            </div>
          </body>
        </html>
      `,
    );

    expect(result.extractionStatus).toBe('recipe_found');
    expect(result.recipeType).toBe('craft');
    expect(result.recipe?.ingredients).toEqual([
      {
        itemName: 'Red Dye',
        buddyUrl: 'https://buddy.farm/i/red-dye/',
        quantity: 1,
      },
      {
        itemName: 'Twine',
        buddyUrl: 'https://buddy.farm/i/twine/',
        quantity: 1,
      },
    ]);
    expect(result.usedIn).toEqual([
      {
        itemName: 'Rucksack',
        buddyUrl: 'https://buddy.farm/i/rucksack/',
        quantity: 4,
      },
    ]);
  });

  it('extracts cooking recipe parameters and ingredients', () => {
    const result = extractBuddyRecipePage(
      {
        itemName: 'Quandary Chowder',
        canonicalKey: 'quandary chowder',
        generatedBuddySlug: 'quandary-chowder',
        candidateBuddyUrl: 'https://buddy.farm/i/quandary-chowder/',
      },
      `
        <html>
          <head><title>Quandary Chowder</title></head>
          <body>
            <h3 id="cooking">Cooking Recipe</h3>
            <div class="bf-list-big-line bf-list-shrink-key list-group list-group-flush">
              <div class="d-flex w-100 justify-content-between gap-4 css-0 list-group-item">
                <a href="/i/jill-s-quandary-chowder/">
                  <div class="bf-list-line-one bf-list-line-one-allow-big css-12tra1i">Jill&#x27;s Quandary Chowder</div>
                  <div class="bf-list-line-two"></div>
                  <span class="bf-list-value d-flex justify-content-end css-ln8i3o">Recipe</span>
                </a>
              </div>
              <div class="d-flex w-100 justify-content-between gap-4 css-0 list-group-item">
                <div class="bf-list-line-one bf-list-line-one-allow-big css-12tra1i">Cooking Level</div>
                <div class="bf-list-line-two"></div>
                <span class="bf-list-value d-flex justify-content-end css-ln8i3o">25</span>
              </div>
              <div class="d-flex w-100 justify-content-between gap-4 css-0 list-group-item">
                <div class="bf-list-line-one bf-list-line-one-allow-big css-12tra1i">Base Time</div>
                <div class="bf-list-line-two"></div>
                <span class="bf-list-value d-flex justify-content-end css-ln8i3o">4h</span>
              </div>
              <div class="d-flex w-100 justify-content-between gap-4 css-0 list-group-item">
                <a href="/i/coal/">
                  <div class="bf-list-line-one bf-list-line-one-allow-big css-12tra1i">Coal</div>
                  <div class="bf-list-line-two"></div>
                  <span class="bf-list-value d-flex justify-content-end css-ln8i3o">10</span>
                </a>
              </div>
              <div class="d-flex w-100 justify-content-between gap-4 css-0 list-group-item">
                <a href="/i/sea-dragon/">
                  <div class="bf-list-line-one bf-list-line-one-allow-big css-12tra1i">Sea Dragon</div>
                  <div class="bf-list-line-two"></div>
                  <span class="bf-list-value d-flex justify-content-end css-ln8i3o">2</span>
                </a>
              </div>
            </div>
          </body>
        </html>
      `,
    );

    expect(result.extractionStatus).toBe('recipe_found');
    expect(result.recipeType).toBe('cooking');
    expect(result.recipe?.recipeBookItem).toEqual({
      itemName: "Jill's Quandary Chowder",
      buddyUrl: 'https://buddy.farm/i/jill-s-quandary-chowder/',
      value: 'Recipe',
    });
    expect(result.recipe?.parameters).toEqual([
      { label: 'Cooking Level', value: '25' },
      { label: 'Base Time', value: '4h' },
    ]);
    expect(result.recipe?.ingredients).toEqual([
      {
        itemName: 'Coal',
        buddyUrl: 'https://buddy.farm/i/coal/',
        quantity: 10,
      },
      {
        itemName: 'Sea Dragon',
        buddyUrl: 'https://buddy.farm/i/sea-dragon/',
        quantity: 2,
      },
    ]);
  });

  it('does not false-positive on unlock text that mentions cooking recipe', () => {
    const result = extractBuddyRecipePage(
      {
        itemName: "Cecil's Shrimp-a-Plenty",
        canonicalKey: "cecil's shrimp-a-plenty",
        generatedBuddySlug: 'cecil-s-shrimp-a-plenty',
        candidateBuddyUrl: 'https://buddy.farm/i/cecil-s-shrimp-a-plenty/',
      },
      `
        <html>
          <head><title>Cecil&#x27;s Shrimp-a-Plenty</title></head>
          <body>
            <div class="bf-list-line-one css-12tra1i">Shrimp-a-Plenty</div>
            <div class="bf-list-line-two">Cooking Recipe</div>
            <span class="bf-list-value d-flex justify-content-end css-ln8i3o">Unlocks</span>
          </body>
        </html>
      `,
    );

    expect(result.extractionStatus).toBe('no_recipe');
    expect(result.recipe).toBeNull();
  });

  it('builds sequential extraction results and review CSVs', async () => {
    const sleepFn = vi.fn().mockResolvedValue(undefined);
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('<html><head><title>Fancy Pipe</title></head><body><h3>Recipe</h3><div class="d-flex w-100 justify-content-between gap-4 css-0 list-group-item"><a href="/i/wood/"><div class="bf-list-line-one">Wood</div><span class="bf-list-value">10</span></a></div></body></html>', { status: 200 }),
      )
      .mockResolvedValueOnce(new Response('', { status: 500 }));

    const extractionResult = await extractBuddyRecipeCandidates(
      [
        {
          itemName: 'Fancy Pipe',
          canonicalKey: 'fancy pipe',
          generatedBuddySlug: 'fancy-pipe',
          candidateBuddyUrl: 'https://buddy.farm/i/fancy-pipe/',
        },
        {
          itemName: 'Broken Page',
          canonicalKey: 'broken page',
          generatedBuddySlug: 'broken-page',
          candidateBuddyUrl: 'https://buddy.farm/i/broken-page/',
        },
      ],
      {
        fetchFn,
        sleepFn,
        interRequestDelayMs: 5,
      },
    );

    expect(extractionResult.summary.countsByStatus).toEqual({
      recipe_found: 1,
      uncertain: 1,
    });
    expect(sleepFn).toHaveBeenCalledTimes(1);
    expect(toBuddyRecipeExtractionSummaryCsv(extractionResult)).toContain('Fancy Pipe');
    expect(toBuddyRecipeExtractionReviewCsv(extractionResult)).toContain('Broken Page');
    expect(toBuddyRecipeExtractionReviewCsv(extractionResult)).not.toContain('Fancy Pipe');
  });
});
