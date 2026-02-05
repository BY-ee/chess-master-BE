import { ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';
import { GetRoomsDto } from './get-rooms.dto';

@ValidatorConstraint({ name: 'isGreaterThanOrEqual', async: false })
export class IsGreaterThanOrEqualConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const object = args.object as any;
    const [relatedPropertyName] = args.constraints;
    const relatedValue = object[relatedPropertyName];
    
    // If either value is missing, skip validation (let other validators handle existence/type)
    if (value === undefined || value === null || relatedValue === undefined || relatedValue === null) {
      return true;
    }
    
    return typeof value === 'number' && typeof relatedValue === 'number' && value >= relatedValue;
  }

  defaultMessage(args: ValidationArguments) {
    const [relatedPropertyName] = args.constraints;
    return `${args.property} must be greater than or equal to ${relatedPropertyName}`;
  }
}
