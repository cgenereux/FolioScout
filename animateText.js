
let previousDisplayValue = '';
let resetHeadlineTimeoutId = null;
let displayAnimating = false;
let pendingDisplayValue = null;
const SLIDE_DURATION_MS = 250;

function animateDisplay(newValue) {
    if (displayAnimating) {
        pendingDisplayValue = newValue;
        return;
    }
    animateDisplayNow(newValue);
}

function flushPendingDisplayValue() {
    if (pendingDisplayValue == null) return;
    const nextValue = pendingDisplayValue;
    pendingDisplayValue = null;
    if (nextValue !== previousDisplayValue) animateDisplay(nextValue);
}

function animateDisplayNow(newValue) {
    const oldValue = previousDisplayValue;
    if (oldValue === newValue) return;
    previousDisplayValue = newValue;

    if (!oldValue) {
        UI.display.textContent = newValue;
        flushPendingDisplayValue();
        return;
    }

    // split into parts: before decimal, decimal, after decimal
    // we align from the decimal point when comparing
    const oldParts = oldValue.split('.');
    const newParts = newValue.split('.');

    const oldLeft = oldParts[0] || '';   // e.g. "$3,241"
    const oldRight = oldParts[1] || '';  // e.g. "68"
    const newLeft = newParts[0] || '';
    const newRight = newParts[1] || '';

    // pad the left parts so they align from the decimal point
    const maxLeftLen = Math.max(oldLeft.length, newLeft.length);
    const oldLeftPadded = oldLeft.padStart(maxLeftLen, ' ');
    const newLeftPadded = newLeft.padStart(maxLeftLen, ' ');

    // pad the right parts so they align from the left
    const maxRightLen = Math.max(oldRight.length, newRight.length);
    const oldRightPadded = oldRight.padEnd(maxRightLen, ' ');
    const newRightPadded = newRight.padEnd(maxRightLen, ' ');

    const oldAligned = oldLeftPadded + (oldRight ? '.' + oldRightPadded : '');
    const newAligned = newLeftPadded + (newRight ? '.' + newRightPadded : '');

    let formattedHtmlString = '';
    let slideDirection = true; // true = up, false = down

    for (let i = 0; i < newAligned.length; i++) {
        const oldChar = oldAligned[i] || ' ';
        const newChar = newAligned[i];

        // blank spaces are represented as a skip in the algorithm 
        if (newChar === ' ') continue;

        const isDigit = /\d/.test(newChar);
        const isDifferent = oldChar !== newChar;

        // only animate digits that are changed
        if (isDigit && isDifferent && oldChar !== ' ') {
            const direction = slideDirection ? 'up' : 'down';
            if (slideDirection) {
                // slide up: slide the new digit up from below the old digit
                formattedHtmlString += `<span class="digit-slot"><span class="digit-stack" data-dir="${direction}"><span>${oldChar}</span><span>${newChar}</span></span></span>`;
            } else {
                // slide down: slide the new digit down from above the old digit
                formattedHtmlString += `<span class="digit-slot"><span class="digit-stack" data-dir="${direction}"><span>${newChar}</span><span>${oldChar}</span></span></span>`;
            }
            slideDirection = !slideDirection; 
        } else {
            formattedHtmlString += newChar;
        }
    }
    UI.display.innerHTML = formattedHtmlString;
    const stacks = UI.display.querySelectorAll('.digit-stack[data-dir]');

    if (stacks.length === 0 || !stacks.length) {
        UI.display.textContent = newValue;
        flushPendingDisplayValue();
        return;
    }
    displayAnimating = true;
    
    // ask for the width to force the browser to paint the starting positions
    void UI.display.offsetWidth;

    // trigger the slide
    stacks.forEach(stack => {
        stack.classList.add('slide-' + stack.dataset.dir);
    });
    setTimeout(() => {
        displayAnimating = false;
        flushPendingDisplayValue();
    }, 260);
}