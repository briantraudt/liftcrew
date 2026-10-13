import {customerHandler} from '../lib/customer-delivery.js';
import {validateCraneRequest} from '../src/crane-fields.js';
import {validateBooking} from '../src/booking-fields.js';
// A preferred crane is only a customer preference; it cannot establish capacity or availability.
export default customerHandler(input=>{
 const error=validateBooking(input);if(error)return {error};
 const result=validateCraneRequest(input);
 if(result.data){delete result.data.cranePreference;result.data.cranePreference=result.data.craneClass?'Requested catalog class '+result.data.craneClass:'Help me choose';}
 return result;
});
