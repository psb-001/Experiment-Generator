document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('experimentForm');
    const btn  = form.querySelector('button[type="submit"]');

    // Load jsPDF — track success/failure
    let jspdfLoaded = false;
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.onload  = () => { jspdfLoaded = true; };
    script.onerror = () => { console.error('Failed to load jsPDF'); };
    document.head.appendChild(script);

    // Restore last used inputs from localStorage
    const nameEl   = document.getElementById('studentName');
    const branchEl = document.getElementById('branch');
    const rollEl   = document.getElementById('rollNumber');
    const saved = JSON.parse(localStorage.getItem('expgen_inputs') || '{}');
    if (saved.studentName) nameEl.value   = saved.studentName;
    if (saved.branch)      branchEl.value = saved.branch;
    if (saved.rollNumber)  rollEl.value   = saved.rollNumber;

    // Keyboard shortcut: Ctrl+Enter / Cmd+Enter submits the form
    document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }
    });

    form.addEventListener('submit', function(e) {
        e.preventDefault();

        const studentName = nameEl.value.trim();
        const branch      = branchEl.value;
        const rollNumber  = rollEl.value.trim();

        // Validate — reject blank or whitespace-only values
        if (!studentName || !branch || !rollNumber) {
            showToast('Please fill in all required fields', true);
            return;
        }
        if (!/\S/.test(studentName)) {
            showToast('Please enter a valid student name', true);
            return;
        }
        if (!/^[a-zA-Z0-9\-\/]+$/.test(rollNumber)) {
            showToast('Roll number should only contain letters, numbers, hyphens or slashes', true);
            return;
        }

        if (!jspdfLoaded) {
            showToast('PDF library is still loading. Please wait a moment and try again.', true);
            return;
        }

        // Save inputs for next visit
        localStorage.setItem('expgen_inputs', JSON.stringify({ studentName, branch, rollNumber }));

        // Loading state
        btn.disabled = true;
        const btnText = document.getElementById('btnText');
        const progressBar = document.getElementById('progressBar');
        btnText.textContent = 'Generating...';

        // Animate progress bar: ramp to 80% quickly, hold, then complete after PDF saves
        progressBar.style.transition = 'none';
        progressBar.style.width = '0%';
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                progressBar.style.transition = 'width 1.2s cubic-bezier(0.4, 0, 0.2, 1)';
                progressBar.style.width = '80%';
            });
        });

        setTimeout(() => {
            try {
                generateExperimentReports(studentName, branch, rollNumber);
                // Complete the bar
                progressBar.style.transition = 'width 0.3s ease';
                progressBar.style.width = '100%';
            } finally {
                setTimeout(() => {
                    btn.disabled = false;
                    btnText.textContent = 'Generate Experiment PDF';
                    progressBar.style.transition = 'width 0.2s ease, opacity 0.3s ease';
                    progressBar.style.opacity = '0';
                    setTimeout(() => {
                        progressBar.style.width = '0%';
                        progressBar.style.opacity = '1';
                    }, 300);
                }, 400);
            }
        }, 50);
    });
});

function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    const icon = toast.querySelector('svg');
    toastMessage.textContent = message;
    // Swap icon color for errors
    icon.classList.toggle('text-hypersail', !isError);
    icon.classList.toggle('text-rosso', isError);
    toast.classList.remove('opacity-0', 'pointer-events-none');
    toast.classList.add('opacity-100');
    setTimeout(() => {
        toast.classList.remove('opacity-100');
        toast.classList.add('opacity-0', 'pointer-events-none');
    }, 3500);
}

function generateExperimentReports(studentName, branch, rollNumber) {
    // Convert header.png to base64 via canvas so jsPDF can embed it reliably
    const img = new Image();
    img.onload = function () {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext('2d').drawImage(img, 0, 0);
        createExperimentPDFs(studentName, branch, rollNumber, canvas.toDataURL('image/png'));
    };
    img.onerror = function () {
        createExperimentPDFs(studentName, branch, rollNumber, null);
    };
    img.src = 'header.png';
}

function createExperimentPDFs(studentName, branch, rollNumber, headerBase64) {
    const { jsPDF } = window.jspdf;
    const experiments = parseExperimentsFromText();

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const PW = doc.internal.pageSize.getWidth();
    const PH = doc.internal.pageSize.getHeight();
    const M  = 15;
    const UW = PW - 2 * M;
    const HDR_H = 24;

    function drawHeader() {
        if (headerBase64) {
            try { doc.addImage(headerBase64, 'PNG', M, 3, UW, HDR_H); }
            catch (e) { console.error(e); }
        }
    }

    function getLineH(fs) {
        doc.setFont('times', 'normal');
        doc.setFontSize(fs);
        // Use jsPDF's actual line height in mm (getLineHeight returns in pt, convert to mm)
        return doc.getLineHeight() / doc.internal.scaleFactor;
    }

    function calcHeight(exp, fs) {
        doc.setFont('times', 'normal');
        doc.setFontSize(fs);
        const lh = getLineH(fs);
        let h = 0;

        exp.code.split('\n').forEach(line => {
            if (!line.trim()) { h += lh; return; }
            // Find comment split point
            let commentIdx = -1;
            let inStr = false, sc = '';
            for (let i = 0; i < line.length - 1; i++) {
                const ch = line[i];
                if (!inStr && (ch === '"' || ch === "'")) { inStr = true; sc = ch; }
                else if (inStr && ch === sc && line[i - 1] !== '\\') { inStr = false; }
                else if (!inStr && ch === '/' && line[i + 1] === '/') { commentIdx = i; break; }
            }
            const codePart = commentIdx >= 0 ? line.slice(0, commentIdx).trimEnd() : line;
            // Code part wraps within full usable width
            const codeWraps = doc.splitTextToSize(codePart || ' ', UW).length;
            h += codeWraps * lh;
        });

        exp.output.split('\n').forEach(line => {
            h += doc.splitTextToSize(line || ' ', UW).length * lh;
        });

        return h;
    }

    experiments.forEach((exp, idx) => {
        if (idx > 0) doc.addPage();

        const OVERHEAD = HDR_H + 3 + 7 + 6 + 7 + 6 + 14 + 6 + 6 + 6 + 6;
        const available = PH - OVERHEAD - M;

        let fs = 9;
        while (fs > 6 && calcHeight(exp, fs) > available) fs -= 0.25;
        const lh = getLineH(fs);

        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, PW, PH, 'F');

        drawHeader();
        let y = HDR_H + 8;

        // Student info
        doc.setFont('times', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.text(`Name: ${studentName}`, M, y);
        doc.text(`Branch: ${getBranchName(branch)}`, PW / 2, y);
        y += 6;
        doc.text(`Roll No: ${rollNumber}`, M, y);
        doc.text('Class: First Year', PW / 2, y);
        y += 6;

        // Separator
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.5);
        doc.line(M, y, PW - M, y);
        y += 7;

        // Title
        doc.setFont('times', 'bold');
        doc.setFontSize(13);
        const titleLines = doc.splitTextToSize(`Experiment ${exp.no}: ${exp.title}`, UW);
        titleLines.forEach(tl => { doc.text(tl, M, y); y += 6; });
        y += 3;

        // Code label
        doc.setFont('times', 'bold');
        doc.setFontSize(11);
        doc.text('Code:', M, y);
        y += 6;

        // Code block — times normal black for code, times normal grey for comments
        exp.code.split('\n').forEach(line => {
            if (!line.trim()) { y += lh; return; }

            // Find // comment not inside a string
            let commentIdx = -1;
            let inStr = false, sc = '';
            for (let i = 0; i < line.length - 1; i++) {
                const ch = line[i];
                if (!inStr && (ch === '"' || ch === "'")) { inStr = true; sc = ch; }
                else if (inStr && ch === sc && line[i - 1] !== '\\') { inStr = false; }
                else if (!inStr && ch === '/' && line[i + 1] === '/') { commentIdx = i; break; }
            }

            const codePart    = commentIdx >= 0 ? line.slice(0, commentIdx).trimEnd() : line;
            const commentPart = commentIdx >= 0 ? line.slice(commentIdx) : '';

            doc.setFont('times', 'normal');
            doc.setFontSize(fs);
            doc.setTextColor(0, 0, 0);

            if (!commentPart) {
                const wrapped = doc.splitTextToSize(codePart, UW);
                wrapped.forEach(wl => { doc.text(wl, M, y); y += lh; });
            } else {
                const codeWidth = doc.getTextWidth(codePart);
                const commentX  = M + codeWidth + 2;
                const commentAvail = PW - M - commentX;
                doc.text(codePart, M, y);

                doc.setTextColor(130, 130, 130);
                if (commentAvail > 10) {
                    const cWrapped = doc.splitTextToSize(commentPart, commentAvail);
                    cWrapped.forEach((cl, ci) => doc.text(cl, commentX, y + ci * lh));
                }
                doc.setTextColor(0, 0, 0);
                y += lh;
            }
        });
        y += 4;

        // Output label
        doc.setFont('times', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.text('Output:', M, y);
        y += 6;

        // Output block
        doc.setFont('times', 'normal');
        doc.setFontSize(fs);
        exp.output.split('\n').forEach(line => {
            const wrapped = doc.splitTextToSize(line || ' ', UW);
            wrapped.forEach(wl => { doc.text(wl, M, y); y += lh; });
        });

        // Page number footer
        doc.setFont('times', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        const pageLabel = `Experiment ${exp.no} of ${experiments.length}`;
        doc.text(pageLabel, PW / 2, PH - 8, { align: 'center' });
        doc.setTextColor(0, 0, 0);
    });

    const safeName = studentName.replace(/\s+/g, '_').replace(/[^\w\-_.]/g, '');
    doc.save(`${safeName}_Experiments.pdf`);

    // Track PDF generation as a custom GoatCounter event
    if (window.goatcounter && window.goatcounter.count) {
        window.goatcounter.count({
            path:  `pdf-generated/${getBranchName(branch)}`,
            title: `PDF Generated — ${getBranchName(branch)}`,
            event: true
        });
    }

    showToast(`PDF generated for ${studentName}`);
}

// Helper function to parse experiments from the text file content
function parseExperimentsFromText() {
    const experimentText = `## Experiment 1: Write a C program to declare and initialize variables of different data types and display their sizes 

### Code:

#include <stdio.h>          // Header file for input-output functions

int main()
{
    // Declaration and initialization of variables of different data types
    int a = 10;             // Integer variable
    float b = 5.5;          // Float (decimal) variable
    double d = 20.12345;    // Double (high precision decimal) variable
    char c = 'A';           // Character variable

    // Displaying values and their sizes using sizeof() operator
    printf("Integer value = %d, Size = %lu bytes\\n", a, sizeof(a));    // %d for integer, %lu for size (unsigned long)
    printf("Float value = %f, Size = %lu bytes\\n", b, sizeof(b));      // %f for float values
    printf("Double value = %lf, Size = %lu bytes\\n", d, sizeof(d));    // %lf for double values
    printf("Character value = %c, Size = %lu bytes\\n", c, sizeof(c)); // %c for character values

    return 0;               // Indicates successful execution of program
}

Output:

Integer value = 10, Size = 4 bytes
Float value = 5.500000, Size = 4 bytes
Double value = 20.123450, Size = 8 bytes
Character value = A, Size = 1 bytes

==========================================================================================================================================================

## Experiment 2: Implement arithmetic, relational, and logical operations in C programs and display the results 

### Code:

#include <stdio.h>          // Header file for input-output functions

int main()
{
    // Declaration and initialization
    int a = 10, b = 5;

    // Arithmetic Operations
    printf("Arithmetic Operations:\\n");
    printf("Addition = %d\\n", a + b);          // Adds a and b
    printf("Subtraction = %d\\n", a - b);        // Subtracts b from a
    printf("Multiplication = %d\\n", a * b);     // Multiplies a and b
    printf("Division = %d\\n", a / b);           // Divides a by b
    printf("Modulus = %d\\n\\n", a % b);          // Remainder of division

    // Relational Operations
    printf("Relational Operations:\\n");
    printf("a > b = %d\\n", a > b);             // Checks if a is greater than b
    printf("a < b = %d\\n", a < b);             // Checks if a is less than b
    printf("a == b = %d\\n", a == b);           // Checks equality
    printf("a != b = %d\\n\\n", a != b);         // Checks inequality

    // Logical Operations
    printf("Logical Operations:\\n");
    printf("(a > b && b > 0) = %d\\n", (a > b && b > 0));   // AND condition
    printf("(a < b || b > 0) = %d\\n", (a < b || b > 0));   // OR condition
    printf("!(a > b) = %d\\n", !(a > b));                    // NOT condition

    return 0;               // Indicates successful execution of program
}

Output:

Arithmetic Operations:
Addition = 15
Subtraction = 5
Multiplication = 50
Division = 2
Modulus = 0

Relational Operations:
a > b = 1
a < b = 0
a == b = 0
a != b = 1

Logical Operations:
(a > b && b > 0) = 1
(a < b || b > 0) = 1
!(a > b) = 0

==========================================================================================================================================================

## Experiment 3:  Write a C program to implement various control flow statements such as if-else, switch-case, and loops, to solve a given problem 

### Code:

#include <stdio.h>          // Header file for input-output functions

int main()
{
    int num, choice, i;

    // Input a number
    printf("Enter a number: ");
    scanf("%d", &num);          // Read number from user

    // IF-ELSE: Check even or odd
    if (num % 2 == 0)           // If remainder is 0, number is even
        printf("Number is Even\\n");
    else
        printf("Number is Odd\\n");

    // SWITCH-CASE: Menu
    printf("\\nMenu:\\n1. Square\\n2. Cube\\n");
    printf("Enter your choice: ");
    scanf("%d", &choice);       // Read menu choice from user

    switch(choice)
    {
        case 1:
            printf("Square = %d\\n", num * num);         // Calculate and print square
            break;
        case 2:
            printf("Cube = %d\\n", num * num * num);     // Calculate and print cube
            break;
        default:
            printf("Invalid Choice\\n");                  // Handle invalid input
    }

    // LOOP: Print numbers from 1 to num
    printf("\\nNumbers from 1 to %d:\\n", num);
    for(i = 1; i <= num; i++)   // Loop from 1 up to num
    {
        printf("%d ", i);       // Print each number
    }

    return 0;                   // Indicates successful execution of program
}

Output:

Enter a number: 5
Number is Odd

Menu:
1. Square
2. Cube
Enter your choice: 1

Square = 25
Numbers from 1 to 5:
1 2 3 4 5

==========================================================================================================================================================

## Experiment 4: Create a function in C to calculate the factorial of a given number and display the result  

### Code:

#include <stdio.h>              // Header file for input-output functions

// Function to calculate factorial
int factorial(int n)
{
    int i, fact = 1;
    // Loop to calculate factorial
    for(i = 1; i <= n; i++)
    {
        fact = fact * i;        // Multiply numbers from 1 to n
    }
    return fact;                // Return computed factorial result
}

int main()
{
    int num, result;

    // Taking input from user
    printf("Enter a number: ");
    scanf("%d", &num);          // Read number from user

    // Calling factorial function
    result = factorial(num);

    // Display result
    printf("Factorial of %d = %d", num, result);

    return 0;                   // Indicates successful execution of program
}

Output:

Enter a number: 6
Factorial of 6 = 720

==========================================================================================================================================================

## Experiment 5:Write a program to find the sum of digits of a number using recursion

### Code:

#include <stdio.h>              // Header file for input-output functions

// Recursive function to find sum of digits
int sumDigits(int n)
{
    // Base condition: stop recursion when n reaches 0
    if(n == 0)
        return 0;
    // Recursive call: extract last digit and add to sum of remaining digits
    return (n % 10) + sumDigits(n / 10);
}

int main()
{
    int num, result;

    // Input number
    printf("Enter a number: ");
    scanf("%d", &num);          // Read number from user

    // Function call
    result = sumDigits(num);    // Store the returned sum of digits

    // Display result
    printf("Sum of digits = %d", result);

    return 0;                   // Indicates successful execution of program
}

Output:

Enter a number: 1234
Sum of digits = 10

==========================================================================================================================================================

## Experiment 6:Develop a program to print the Fibonacci series using a loop

### Code:

#include <stdio.h>              // Header file for input-output functions

int main()
{
    int n, i;
    int a = 0, b = 1, c;       // a and b are the first two terms; c holds next computed term

    // Input number of terms
    printf("Enter number of terms: ");
    scanf("%d", &n);            // Read number of terms from user

    // Print first two terms
    printf("Fibonacci Series: %d %d", a, b);

    // Loop to generate remaining terms
    for(i = 3; i <= n; i++)    // Start from 3rd term as first two are already printed
    {
        c = a + b;              // Calculate next term by adding previous two
        printf(" %d", c);       // Print the next term
        a = b;                  // Shift a forward to b's value
        b = c;                  // Shift b forward to newly computed term
    }

    return 0;                   // Indicates successful execution of program
}

Output:

Enter number of terms: 6
Fibonacci Series: 0 1 1 2 3 5

==========================================================================================================================================================

## Experiment 7: Write a C program to initialize and display elements of a one-dimensional array 

### Code:

#include <stdio.h>              // Header file for input-output functions

int main()
{
    // Declare and initialize array with 5 elements
    int arr[5] = {10, 20, 30, 40, 50};
    int i;                      // Loop variable for traversal

    // Display array elements using loop
    printf("Array elements are:\\n");

    for(i = 0; i < 5; i++)     // Iterate from index 0 to 4
    {
        printf("arr[%d] = %d\\n", i, arr[i]);    // Print index and corresponding element
    }

    return 0;                   // Indicates successful execution of program
}

Output:

Array elements are:
arr[0] = 10
arr[1] = 20
arr[2] = 30
arr[3] = 40
arr[4] = 50

==========================================================================================================================================================

## Experiment 8: Implement a program to find the largest and smallest elements in an array

### Code:

#include <stdio.h>              // Header file for input-output functions

int main()
{
    int arr[100], n, i;         // Array of max 100 elements, n for count, i for loop
    int max, min;               // Variables to store largest and smallest values

    // Input number of elements
    printf("Enter number of elements: ");
    scanf("%d", &n);            // Read count from user

    // Input array elements
    printf("Enter %d elements:\\n", n);
    for(i = 0; i < n; i++)
    {
        scanf("%d", &arr[i]);   // Read each element into the array
    }

    // Initialize max and min with the first element
    max = min = arr[0];

    // Find largest and smallest
    for(i = 1; i < n; i++)     // Compare each element starting from index 1
    {
        if(arr[i] > max)
        {
            max = arr[i];       // Update max if a larger element is found
        }
        if(arr[i] < min)
        {
            min = arr[i];       // Update min if a smaller element is found
        }
    }

    // Display results
    printf("Largest element = %d\\n", max);
    printf("Smallest element = %d\\n", min);

    return 0;                   // Indicates successful execution of program
}

Output:

Enter number of elements: 5
Enter elements: 10 25 5 40 15
Largest element = 40
Smallest element = 5`;

    const experiments = [];
    const experimentBlocks = experimentText.split(/={50,}/);

    experimentBlocks.forEach(block => {
        const trimmed = block.trim();
        if (!trimmed) return;

        const titleMatch = trimmed.match(/##\s+Experiment\s+(\d+):\s*([\s\S]*?)(?=###|\n\n|$)/i);
        if (!titleMatch) return;

        const expNo = parseInt(titleMatch[1]);
        const expTitle = titleMatch[2].trim();

        const codeMatch = trimmed.match(/###\s*Code:\s*([\s\S]*?)(?=Output:)/i);
        const code = codeMatch ? codeMatch[1].trim() : 'No code available';

        const outputMatch = trimmed.match(/Output:\s*([\s\S]*)/i);
        const output = outputMatch ? outputMatch[1].trim() : 'No output available';

        experiments.push({ no: expNo, title: expTitle, code: code, output: output });
    });

    return experiments;
}

// Helper function to get branch display name
function getBranchName(branchValue) {
    const branchMap = {
        'computer-engineering': 'Computer Engineering',
        'ai-ml': 'AI/ML',
        'it': 'IT',
        'entc': 'ENTC'
    };
    return branchMap[branchValue] || branchValue;
}
