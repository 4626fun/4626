[**4626-app**](../../../../index.md)

***

[4626-app](../../../../index.md) / api/\_handlers/admin/waitlist/\_delete

# api/\_handlers/admin/waitlist/\_delete

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`any`\>

Defined in: [api/\_handlers/admin/waitlist/\_delete.ts:20](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/admin/waitlist/_delete.ts#L20)

DELETE a waitlist profile by id.

Use this to remove duplicate/orphan profiles (e.g. synthetic-email profiles
created by the auth bridge that were superseded by a real signup).

Admin-only. Permanently deletes the row and any associated referral data.

#### Parameters

##### req

`any`

##### res

`any`

#### Returns

`Promise`\<`any`\>
