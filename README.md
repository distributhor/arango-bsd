# Guacamole - A [backseat] driver for ArangoDB

[![GitHub Release][ico-release]][link-github-release]
[![License][ico-license]](LICENSE)
<!--
[![Total alerts][lgtm-alerts]][link-lgtm-alerts]
[![Language grade: JavaScript][lgtm-code-quality]][link-lgtm-code-quality]
-->

While no one likes backseat driver, sometimes a few extra instructions can't be avoided. That is the philosophy behind Guacamole. Think of it more as a thin wrapper that exposes the native `ArangoJS` driver (so you can keep on using it without friction), while adding a few potentially useful functions. 

The primary aim is not to take over the main job of using the native driver, but rather to get out of the way, while allowing you to use the additional functionality if it's helpful. In fact, it's possible to use this package and only ever stick to the natively exposed `ArangoJS` driver and it's native functions. But, like a true backset driver, we had to throw in a few additional instructions.

On that note: this tool primarily came into existence to address a number of common use cases from `within our own world`, and is therefore very limited in what it attempts to be. The additional functionality relates mostly to a few CRUD operations, array manipulation, and the ability to perform simple queries easily, across data in single collections (as opposed to operations intended for graphs and traversals). 

As such, this is a basic tool, which may or not cover your use cases.

Introductory documentation follows below. It's best to read in conjunction with the [API Reference](https://distributhor.github.io/guacamole/) for additional details. API reference URL: [https://distributhor.github.io/guacamole/](https://distributhor.github.io/guacamole/)

## Quick Start

The following is a basic example, which will also give you a succinct idea of the types of things this tool aims to help with.

The two main classes that you will typically interface with, are:

- [ArangoDB](https://distributhor.github.io/guacamole/classes/index.ArangoDB.html): A thin wrapper around an `ArangoJS` [Database](https://arangodb.github.io/arangojs/8.1.0/classes/database.Database.html) instance. It provides direct and easy access to the ArangoJS instance itself, but also adds a few convenience methods, for optional use.
- [ArangoConnection](https://distributhor.github.io/guacamole/classes/index.ArangoConnection.html): A class that manages instances of [ArangoDB](https://distributhor.github.io/guacamole/classes/index.ArangoDB.html). An `ArangoDB` instance deals with only one `ArangoJS` [Database](https://arangodb.github.io/arangojs/8.1.0/classes/database.Database.html). If you only need to work with one database, then simply use the `ArangoDB` class directly, but if you want to use different databases interchangeably in the same code, then `ArangoConnection` could potentially make that easier. It's not without limitation - read the documentation further below to understand it's usage and limits.

Construct an instance.

```javascript
// const { ArangoDB } = require('@distributhor/guacamole')
import { ArangoDB } from '@distributhor/guacamole'

const db = new ArangoDB({
   databaseName: process.env.DB_NAME,
   url: process.env.DB_URL,
   auth: {
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD
   }
})
```

The configuration object passed into the constructor is a standard `ArangoJS` [Config](https://arangodb.github.io/arangojs/8.1.0/types/connection.Config.html) object. It will also accept an existing `ArangoJS` [Database](https://arangodb.github.io/arangojs/8.1.0/classes/database.Database.html) instance.

Then perform some operations ...

```javascript
// Fetch one result only, it will return the first match
// By default the the value is considered case insensitive
// Other than case, it will match on the exact value
// Will match "nicosmith@email.com" and "NicoSmith@Email.com"
// Won't match "nico@email.com"
const person = await fetchOneByPropertyValue(
   'users', 
   { 
      property: 'email', 
      value: 'nicosmith@email.com' 
   }
)

// Fetch all results that matches the property value
// By default the the value is considered case insensitive
// Other than case, it will match on the exact value
// Will match "nico" and "Nico"
// Won't match "nic" or "nicolas"
const peopleNamedNico = await fetchByPropertyValue(
   'users', 
   { 
      property: 'firstName', 
      value: 'nico' 
   }
)

// Fetch all results that matches the exact property value
// Stipulate that the match should be case sensitive
// Limit the result to 10 and sort by lastName property
// Will match only "Nico"
// Won't match "nico"
const peopleNamedNicoV2 = await fetchByPropertyValue(
   'users', 
   { 
      property: 'firstName', 
      value: 'Nico',
      options: {
        caseSensitive: true
      } 
   },
   { 
      limit: 10,
      sortBy: 'lastName'
   }
)

// Fetch all results that matches the search criteria
// The terms are considered case insentitive and not exact
// Will match values such as "Nicolas" and "William"
// Will, of course, also match "nic" and "Wil"
const peopleNamedNicoV3 = await fetchByCriteria(
   'users', 
   search: {
      props: 'name', terms: ['nic', 'wil']
   }
)

// Fetch all results where gender == 'M'
// AND the name matches anything containing "joe"
// Return the ArangoJS ArrayCursor instead of .all()
const peopleNamedNicoV4 = await fetchByPropertyValueAndCriteria(
   'users', 
   { 
      property: 'gender', 
      value: 'M' 
   }
   search: {
      props: 'name', terms: 'nic'
   },
   { 
      returnCursor: true
   }
)
```

## Table Of Contents

The documentation below does not replace the official [API Reference](https://distributhor.github.io/guacamole/) (which contain additional details), but it does provide simple introductions and usage examples for each function. The snippets without checkmarks imply that the documentation is not yet done for that section, but gives an interim overview of what is to come.

#### About The Naming Convention

*TODO ...*

### Without Sauce
#### - Constructors & Connection Management
- [x] [ArangoDB](#ArangoDB)
- [x] [ArangoConnection](#ArangoConnection)

#### - Native Driver, AQL Queries & CRUD
- [x] [ArangoJS Driver](#The-ArangoJS-Driver)
- [x] [AQL Queries](#AQL-Queries)
- [ ] [CRUD Operations](#CRUD-Operations)

#### - Utility
- [ ] [trimDocuments](#trimDocuments)
- [ ] [validateUniqueConstraint](#validateUniqueConstraint)

#### - Criteria Queries & Property-Based Data Fetching
- [ ] [fetchAll](#fetchAll)
- [ ] [fetchByProperties](#fetchByProperties)
- [ ] [fetchOneByProperties](#fetchByProperties)
- [ ] [fetchByCriteria](#fetchByCriteria)
- [ ] [fetchByPropertiesAndCriteria](#fetchByPropertiesAndCriteria)

### With Sauce
#### - Human Readable & Refactorable Criteria Queries
- [ ] [fetchByPropertyValue](#fetchByPropertyValue)
- [ ] [fetchByAnyPropertyValue](#fetchByAnyPropertyValue)
- [ ] [fetchByAllPropertyValues](#fetchByAllPropertyValues)
- [ ] [fetchOneByPropertyValue](#fetchOneByPropertyValue)
- [ ] [fetchOneByAnyPropertyValue](#fetchOneByAnyPropertyValue)
- [ ] [fetchOneByAllPropertyValues](#fetchOneByAllPropertyValues)
- [ ] [fetchByPropertyValueAndCriteria](#fetchByPropertyValueAndCriteria)
- [ ] [fetchByAnyPropertyValueAndCriteria](#fetchByAnyPropertyValueAndCriteria)
- [ ] [fetchByAllPropertyValuesAndCriteria](#fetchByAllPropertyValuesAndCriteria)

### With Spice
#### - Array Helpers (WIP)
- [ ] [addArrayValue](#addArrayValue)
- [ ] [removeArrayValue](#removeArrayValue)
- [ ] [addArrayObject](#addArrayObject)
- [ ] [removeArrayObject](#removeArrayObject)
- [ ] [updateArrayObject](#updateArrayObject)
- [ ] [replaceArrayObject](#replaceArrayObject)
- [ ] [replaceArray](#replaceArray)


## Constructors & Connection Management
### ArangoDB
[ArangoDB](https://distributhor.github.io/guacamole/classes/index.ArangoDB.html): This is the main class and interface. It provides direct and easy access to the ArangoJS instance/driver itself, but adds methods which can be used optionally.

The configuration object passed into the constructor is a standard `ArangoJS` [Config](https://arangodb.github.io/arangojs/8.1.0/types/connection.Config.html) object. It will also accept an existing `ArangoJS` [Database](https://arangodb.github.io/arangojs/8.1.0/classes/database.Database.html) instance.

Optionally, a second parameter accepts a [GuacamoleOptions](https://distributhor.github.io/guacamole/interfaces/types.GuacamoleOptions.html) object, which provides additional configuration options.

```javascript
const db = new ArangoDB({
   databaseName: process.env.DB_NAME,
   url: process.env.DB_URL,
   auth: {
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD
   }
})
```

```javascript
import { Database } from "arangojs"

const ajsdb = new Database({
   databaseName: process.env.DB_NAME,
   url: process.env.DB_URL,
   auth: {
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD
   }
})

const db = new ArangoDB(ajsdb)
```

### ArangoConnection
[ArangoConnection](https://distributhor.github.io/guacamole/classes/index.ArangoConnection.html): A class that manages instances of `ArangoDB`. An `ArangoDB` instance deals with only one `ArangoJS Database`. If you only need to work with one database, then simply use the `ArangoDB` class directly, but if you want to use different databases interchangeably in the same code, then `ArangoConnection` could potentially make that easier.

It is not without limitations though, and it's important to understand how it behaves. 

*TODO: finish describing how it behaves.*

```javascript
const con = new ArangoConnection({
   databaseName: 'dbName1',
   url: process.env.DB_URL,
   auth: {
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD
   }
})

// or alternatively, if the other database(s) require 
// different credentials, pass an array of config

const con = new ArangoConnection([{
   databaseName: 'dbName1',
   url: process.env.DB_URL,
   auth: {
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD
   }
}, {
   databaseName: 'dbName2',
   url: process.env.DB_URL_2,
   auth: {
      username: process.env.DB_USER_2,
      password: process.env.DB_PASSWORD_2
   }
}])

// db1 = ArangoDB instance for dbName1
const db1 = con.db('dbName1')
db1.query(aql`FOR d IN user FILTER d.name LIKE ${name} RETURN d`)

// or simply ...
con.db('dbName1').query(aql`FOR d IN user FILTER d.name LIKE ${name} RETURN d`)

// and working with ArangoDB instance for dbName2
con.db('dbName2').fetchByCriteria('user', {
   search: { 
      properties: 'name', 
      terms: ${name} 
   },
})
```

## Native Driver, AQL Queries & CRUD
### The ArangoJS Driver

The native `ArangoJS` driver is exposed on a public `.driver` property of the `ArangoDB` class. By using `db.driver` you always have the full native capability available.

```javascript
const cursor = await db.driver.query(aql`FOR d IN user FILTER d.name LIKE ${name} RETURN d`)

const document = await db.driver.collection.document('abc123')
```

### AQL Queries

To perform an AQL query you can, of course, just use the native driver. However, in the case of the `query` method (since it's used so much) there's a direct version available without having to use `.driver` first.

```javascript
const cursor = await db.query(aql`FOR d IN user FILTER d.name LIKE ${name} RETURN d`)
```

This returns the standard `ArangoJS ArrayCursor ` as per normal. If you don't want use the `ArrayCursor` and prefer to simply return all results immediately (equivalent to invoking `cursor.all()` - the usual warnings apply) ...

```javascript
const results = await db. returnAll(aql`FOR d IN user FILTER d.name LIKE ${name} RETURN d`)

for (const r of result) {
	console.log(r)
}
```

[Back to top](#table-of-contents)

### CRUD Operations

*TODO: finish documentation for this section*

[Back to top](#table-of-contents)


## Criteria Queries & Property-Based Data Fetching

### Introduction

Here now

### Methods
[fetchAll](https://distributhor.github.io/guacamole/classes/index.ArangoDB.html#fetchAll): here now

[Back to top](#table-of-contents)

## License

The MIT License (MIT). Please see [License File](LICENSE) for more information.

[ico-license]: https://img.shields.io/badge/license-MIT-brightgreen.svg
[ico-release]: https://img.shields.io/github/tag/distributhor/guacamole.svg
[link-github-release]: https://github.com/distributhor/guacamole/releases
[lgtm-alerts]: https://img.shields.io/lgtm/alerts/g/distributhor/guacamole.svg?logo=lgtm&logoWidth=18
[link-lgtm-alerts]: https://lgtm.com/projects/g/distributhor/guacamole/alerts/
[lgtm-code-quality]: https://img.shields.io/lgtm/grade/javascript/g/distributhor/guacamole.svg?logo=lgtm&logoWidth=18
[link-lgtm-code-quality]: https://lgtm.com/projects/g/distributhor/guacamole/context:javascript
