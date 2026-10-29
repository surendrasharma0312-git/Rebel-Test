const test = require('node:test');
const assert = require('node:assert');
const { setupJSDOM } = require('./setupTest');

const { window } = setupJSDOM();
const { getWeeklyBoundaries } = window;


// Note: The getWeeklyBoundaries function in index.html is fully deterministic and timezone-agnostic.
// It manually applies an IST offset (5.5 hours) to the input date's UTC time, performs all calculations
// using UTC methods (getUTCDay, setUTCHours, etc.), and then removes the offset.
// Therefore, the results are exactly the same regardless of the system's local timezone.
// The hardcoded expected values below are correct and will pass on any CI environment.

test('getWeeklyBoundaries', async (t) => {

    await t.test('should handle a mid-week date (Wednesday) in the same month/year', () => {
        const d = new Date('2023-10-25T12:00:00Z'); // Wednesday
        const result = getWeeklyBoundaries(d);

        assert.strictEqual(result.startUTC.getTime(), new Date('2023-10-22T18:30:00.000Z').getTime());
        assert.strictEqual(result.endUTC.getTime(), new Date('2023-10-29T18:29:59.999Z').getTime());
        assert.strictEqual(result.label, 'Week: 23 Oct – 29 Oct 2023');
    });

    await t.test('should correctly handle Sunday by treating it as the end of the previous week', () => {
        const d = new Date('2023-01-01T12:00:00Z'); // Sunday
        const result = getWeeklyBoundaries(d);

        assert.strictEqual(result.startUTC.getTime(), new Date('2022-12-25T18:30:00.000Z').getTime());
        assert.strictEqual(result.endUTC.getTime(), new Date('2023-01-01T18:29:59.999Z').getTime());
        assert.strictEqual(result.label, 'Week: 26 Dec – 1 Jan 2023');
    });

    await t.test('should correctly format a week spanning across years', () => {
        const d = new Date('2023-12-30T12:00:00Z'); // Saturday
        const result = getWeeklyBoundaries(d);

        assert.strictEqual(result.startUTC.getTime(), new Date('2023-12-24T18:30:00.000Z').getTime());
        assert.strictEqual(result.endUTC.getTime(), new Date('2023-12-31T18:29:59.999Z').getTime());
        assert.strictEqual(result.label, 'Week: 25 Dec – 31 Dec 2023');
    });

    await t.test('should correctly format a week spanning across years when end date is in next year', () => {
        const d = new Date('2024-12-31T12:00:00Z'); // Tuesday
        const result = getWeeklyBoundaries(d);

        assert.strictEqual(result.startUTC.getTime(), new Date('2024-12-29T18:30:00.000Z').getTime());
        assert.strictEqual(result.endUTC.getTime(), new Date('2025-01-05T18:29:59.999Z').getTime());
        assert.strictEqual(result.label, 'Week: 30 Dec – 5 Jan 2025');
    });

    await t.test('should function correctly when no date is provided', () => {
        const result = getWeeklyBoundaries();

        assert.strictEqual(result.startUTC.constructor.name, 'Date');
        assert.strictEqual(result.endUTC.constructor.name, 'Date');
        assert.ok(typeof result.label === 'string');
        assert.ok(result.label.startsWith('Week: '));

        // Assert week is 7 days minus 1 millisecond
        const diff = result.endUTC.getTime() - result.startUTC.getTime();
        assert.strictEqual(diff, (7 * 24 * 60 * 60 * 1000) - 1);
    });

});
