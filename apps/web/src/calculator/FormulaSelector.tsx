import { Radio } from 'antd';
import type { RadioChangeEvent } from 'antd';
import type { ComparisonFormula } from './engine/comparison.type';
import { formulaLabels } from './formula-labels';

type FormulaSelectorProps = {
    formula: ComparisonFormula;
    onChange: (formula: ComparisonFormula) => void;
};

export function FormulaSelector({ formula, onChange }: FormulaSelectorProps) {
    const handleChange = (event: RadioChangeEvent): void => {
        const selected: unknown = event.target.value;
        if (selected === 'wilks' || selected === 'ipf-gl' || selected === 'dots') {
            onChange(selected);
        }
    };

    return (
        <fieldset className="m-0 min-w-0 border-0 p-0">
            <legend id="formula-label" className="mb-2">
                Формула для всех спортсменов
            </legend>
            <Radio.Group
                aria-labelledby="formula-label"
                value={formula}
                onChange={handleChange}
                className="flex flex-col gap-2"
            >
                <Radio value="wilks" className="calculator-formula-choice">
                    {formulaLabels.wilks}
                </Radio>
                <Radio value="ipf-gl" className="calculator-formula-choice">
                    {formulaLabels['ipf-gl']}
                </Radio>
                <Radio value="dots" className="calculator-formula-choice">
                    {formulaLabels.dots}
                </Radio>
            </Radio.Group>
        </fieldset>
    );
}
