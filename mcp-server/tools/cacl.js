
import { z } from './utils.js';

export default function calculate() {
    return {
        name: "calculate",
        description: "Calculate the sum of two numbers",
        schema: {
            num1: z.number().describe("First number for calculation"),
            num2: z.number().describe("Second number for calculation"),
            operation: z.enum(['add', 'subtract', 'multiply', 'divide']).describe("Operation to perform: add, subtract, multiply, or divide")
        },
        handler: async ({ num1, num2, operation }) => {

            // 检查参数类型
            if (typeof num1 !== 'number' || typeof num2 !== 'number') {
                return {
                    content: [{
                        type: "text",
                        text: "calculate Error: Both num1 and num2 must be numbers."
                    }]
                };
            }

            let result;
            switch (operation) {
                case 'add':
                    result = num1 + num2;
                    break;
                case 'subtract':
                    result = num1 - num2;
                    break;
                case 'multiply':
                    result = num1 * num2;
                    break;
                case 'divide':
                    if (num2 === 0) {
                        return {
                            content: [{
                                type: "text",
                                text: "Error: Division by zero is not allowed."
                            }]
                        };
                    }
                    result = num1 / num2;
                    break;
            }

            return {
                content: [{
                    type: "text",
                    text: `The result of ${num1} ${operation} ${num2} = ${result}`
                }]
            };
        }
    };
}
