document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('experimentForm');
    
    // Load jsPDF on page load
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    document.head.appendChild(script);
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Get form values
        const studentName = document.getElementById('studentName').value.trim();
        const branch = document.getElementById('branch').value;
        const rollNumber = document.getElementById('rollNumber').value.trim();
        
        // Validate inputs
        if (!studentName || !branch || !rollNumber) {
            alert('Please fill in all required fields');
            return;
        }
        
        // Generate PDF
        generateExperimentReports(studentName, branch, rollNumber);
    });
});

function generateExperimentReports(studentName, branch, rollNumber) {
    if (typeof jspdf === 'undefined') {
        alert('PDF library is still loading. Please try again in a moment.');
        return;
    }
    
    createExperimentPDFs(studentName, branch, rollNumber);
}

function createExperimentPDFs(studentName, branch, rollNumber) {
    const { jsPDF } = window.jspdf;
    
    // Parse experiments from the text file content
    const experiments = parseExperimentsFromText();
    
    // Create a single PDF with all experiments
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const usableWidth = pageWidth - 2 * margin;
    
    experiments.forEach((exp, index) => {
        // Add new page for each experiment (except first)
        if (index > 0) {
            doc.addPage();
        }
        
        // White background
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        
        // Add header image - scaled to fit with margins
        try {
            const headerWidth = pageWidth - 20; // Reduced width to add margins
            const headerHeight = 20; // Reduced height
            const headerX = 10; // Center with margin
            doc.addImage('header.png', 'PNG', headerX, 0, headerWidth, headerHeight);
        } catch (error) {
            console.error('Error adding header:', error);
        }
        
        let yPosition = 28; // Start below header
        
        // Student information - larger, highlighted font, side by side
        doc.setFont('times', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        
        // Student info in two lines to save space
        const line1 = `Name: ${studentName}    |    Branch: ${getBranchName(branch)}`;
        const line2 = `Roll Number: ${rollNumber}    |    Class: First Year`;
        
        doc.text(line1, margin, yPosition);
        yPosition += 7;
        doc.text(line2, margin, yPosition);
        yPosition += 7;
        
        // Separator line
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.4);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 7;
        
        // Experiment title - bold, medium size
        doc.setFont('times', 'bold');
        doc.setFontSize(13);
        
        // Handle long titles
        const titleText = `Experiment ${exp.no}: ${exp.title}`;
        const titleLines = doc.splitTextToSize(titleText, usableWidth);
        titleLines.forEach(line => {
            doc.text(line, margin, yPosition);
            yPosition += 6;
        });
        
        yPosition += 4;
        
        // Code section header
        doc.setFont('times', 'bold');
        doc.setFontSize(10);
        doc.text('Code:', margin, yPosition);
        yPosition += 6;
        
        // Code content - medium font to fit
        doc.setFont('times', 'normal');
        doc.setFontSize(9);
        const codeLines = doc.splitTextToSize(exp.code, usableWidth);
        
        codeLines.forEach(line => {
            // If approaching end of page, reduce spacing
            if (yPosition > pageHeight - 25) {
                doc.addPage();
                doc.setFillColor(255, 255, 255);
                doc.rect(0, 0, pageWidth, pageHeight, 'F');
                yPosition = 15;
            }
            doc.text(line, margin, yPosition);
            yPosition += 4.2;
        });
        
        yPosition += 4;
        
        // Output section
        if (yPosition > pageHeight - 30) {
            doc.addPage();
            doc.setFillColor(255, 255, 255);
            doc.rect(0, 0, pageWidth, pageHeight, 'F');
            yPosition = 15;
        }
        
        doc.setFont('times', 'bold');
        doc.setFontSize(10);
        doc.text('Output:', margin, yPosition);
        yPosition += 6;
        
        doc.setFont('times', 'normal');
        doc.setFontSize(9);
        const outputLines = doc.splitTextToSize(exp.output, usableWidth);
        
        outputLines.forEach(line => {
            if (yPosition > pageHeight - 12) {
                doc.addPage();
                doc.setFillColor(255, 255, 255);
                doc.rect(0, 0, pageWidth, pageHeight, 'F');
                yPosition = 15;
            }
            doc.text(line, margin, yPosition);
            yPosition += 4.2;
        });
    });
    
    // Save the complete PDF
    const safeStudentName = studentName.replace(/\s+/g, '_').replace(/[^\w\-_\.]/g, '');
    doc.save(`${safeStudentName}_Experiments.pdf`);
    
    alert(`Generated experiment report PDF for ${studentName}`);
}

// Helper function to parse experiments from the text file content
function parseExperimentsFromText() {
    const experimentText = `## Experiment 1: Write a C program to declare and initialize variables of different data types and display their sizes 

### Code:

#include <stdio.h>

int main()
{
    int a = 10;
    float b = 5.5;
    double d = 20.12345;
    char c = 'A';

    printf("Integer value = %d, Size = %lu bytes\\n", a, sizeof(a));
    printf("Float value = %f, Size = %lu bytes\\n", b, sizeof(b));
    printf("Double value = %lf, Size = %lu bytes\\n", d, sizeof(d));
    printf("Character value = %c, Size = %lu bytes\\n", c, sizeof(c));

    return 0;
}

Output:

Integer value = 10, Size = 4 bytes
Float value = 5.500000, Size = 4 bytes
Double value = 20.123450, Size = 8 bytes
Character value = A, Size = 1 bytes

==========================================================================================================================================================

## Experiment 2: Implement arithmetic, relational, and logical operations in C programs and display the results 

### Code:

#include <stdio.h>

int main()
{
    int a = 10, b = 5;

    printf("Arithmetic Operations:\\n");
    printf("Addition = %d\\n", a + b);
    printf("Subtraction = %d\\n", a - b);
    printf("Multiplication = %d\\n", a * b);
    printf("Division = %d\\n", a / b);
    printf("Modulus = %d\\n\\n", a % b);

    printf("Relational Operations:\\n");
    printf("a > b = %d\\n", a > b);
    printf("a < b = %d\\n", a < b);
    printf("a == b = %d\\n", a == b);
    printf("a != b = %d\\n\\n", a != b);

    printf("Logical Operations:\\n");
    printf("(a > b && b > 0) = %d\\n", (a > b && b > 0));
    printf("(a < b || b > 0) = %d\\n", (a < b || b > 0));
    printf("!(a > b) = %d\\n", !(a > b));

    return 0;
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

#include <stdio.h>

int main()
{
    int num, choice, i;

    printf("Enter a number: ");
    scanf("%d", &num);

    if (num % 2 == 0)
        printf("Number is Even\\n");
    else
        printf("Number is Odd\\n");

    printf("\\nMenu:\\n1. Square\\n2. Cube\\n");
    printf("Enter your choice: ");
    scanf("%d", &choice);

    switch(choice)
    {
        case 1:
            printf("Square = %d\\n", num * num);
            break;
        case 2:
            printf("Cube = %d\\n", num * num * num);
            break;
        default:
            printf("Invalid Choice\\n");
    }

    printf("\\nNumbers from 1 to %d:\\n", num);
    for(i = 1; i <= num; i++)
    {
        printf("%d ", i);
    }

    return 0;
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

#include <stdio.h>

int factorial(int n)
{
    int i, fact = 1;
    for(i = 1; i <= n; i++)
    {
        fact = fact * i;
    }
    return fact;
}

int main()
{
    int num, result;

    printf("Enter a number: ");
    scanf("%d", &num);

    result = factorial(num);
    printf("Factorial of %d = %d", num, result);

    return 0;
}

Output:

Enter a number: 6
Factorial of 6 = 720

==========================================================================================================================================================


## Experiment 5:Write a program to find the sum of digits of a number using recursion

### Code:

#include <stdio.h>

int sumDigits(int n)
{
    if(n == 0)
        return 0;
    return (n % 10) + sumDigits(n / 10);
}

int main()
{
    int num, result;

    printf("Enter a number: ");
    scanf("%d", &num);

    result = sumDigits(num);
    printf("Sum of digits = %d", result);

    return 0;
}


Output:

Enter a number: 1234
Sum of digits = 10

==========================================================================================================================================================

## Experiment 6:Develop a program to print the Fibonacci series using a loop

### Code:

#include <stdio.h>

int main()
{
    int n, i;
    int a = 0, b = 1, c;

    printf("Enter number of terms: ");
    scanf("%d", &n);

    printf("Fibonacci Series: %d %d", a, b);

    for(i = 3; i <= n; i++)
    {
        c = a + b;
        printf(" %d", c);
        a = b;
        b = c;
    }

    return 0;
}


Output:

Enter number of terms: 6
Fibonacci Series: 0 1 1 2 3 5

==========================================================================================================================================================

## Experiment 7: Write a C program to initialize and display elements of a one-dimensional array 

### Code:

#include <stdio.h>

int main()
{
    int arr[5] = {10, 20, 30, 40, 50};
    int i;

    printf("Array elements are:\\n");

    for(i = 0; i < 5; i++)
    {
        printf("arr[%d] = %d\\n", i, arr[i]);
    }

    return 0;
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

#include <stdio.h>

int main()
{
    int arr[100], n, i;
    int max, min;

    printf("Enter number of elements: ");
    scanf("%d", &n);

    printf("Enter %d elements:\\n", n);
    for(i = 0; i < n; i++)
    {
        scanf("%d", &arr[i]);
    }

    max = min = arr[0];

    for(i = 1; i < n; i++)
    {
        if(arr[i] > max)
            max = arr[i];

        if(arr[i] < min)
            min = arr[i];
    }

    printf("Largest element = %d\\n", max);
    printf("Smallest element = %d\\n", min);

    return 0;
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
        
        // Extract experiment number and title
        const titleMatch = trimmed.match(/##\s+Experiment\s+(\d+):\s*([\s\S]*?)(?=###|\n\n|$)/i);
        if (!titleMatch) return;
        
        const expNo = parseInt(titleMatch[1]);
        const expTitle = titleMatch[2].trim();
        
        // Extract code
        const codeMatch = trimmed.match(/###\s*Code:\s*([\s\S]*?)(?=Output:)/i);
        const code = codeMatch ? codeMatch[1].trim() : 'No code available';
        
        // Extract output
        const outputMatch = trimmed.match(/Output:\s*([\s\S]*)/i);
        const output = outputMatch ? outputMatch[1].trim() : 'No output available';
        
        experiments.push({
            no: expNo,
            title: expTitle,
            code: code,
            output: output
        });
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