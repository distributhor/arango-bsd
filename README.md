# Guacamole - A [backseat] driver for ArangoDB

[![GitHub Release][ico-release]][link-github-release]
[![License][ico-license]](LICENSE)
<!--
[![Total alerts][lgtm-alerts]][link-lgtm-alerts]
[![Language grade: JavaScript][lgtm-code-quality]][link-lgtm-code-quality]
-->

While no one likes backseat driver, sometimes a little help or extra instructions can't be avoided. That is the philosophy behind Guacamole. Think of it more as a thin wrapper that exposes the native `ArangoJS` driver, while adding a few potentially useful functions for some common use cases. The primary aim is not to take over the main job of using the native driver, or to add any friction to it's use; but rather to get out of the way completely, and only make available the additional functionality as an optional extra. In fact, it's possible to use this package and only ever stick to the natively exposed `ArangoJS` driver, without choosing to leverage any other functionality. But, like a true backset driver, we added a few additional instructions, mostly of the kind that are performed repetitively.

On that note: this tool primarily started its existence to address some common cases derived from *our own world*, and is therefore very limited in what it attempts to be. The additional functionality relates mostly to simple CRUD operations, array manipulation operations, and the ability to easily query data in single collections (as opposed to operations intended for graphs and traversals). As such, this is a basic tool, which may or not fit your use case. But for the types of tasks that it does perform, it's probably useful enough to make available to a larger audience.

You can find the generated [API reference](https://distributhor.github.io/guacamole/) for this package here: 

[https://distributhor.github.io/guacamole/](https://distributhor.github.io/guacamole/)

Introductory documentation follows below, by way of examples, which does not cover any details. It's best used in conjunction with the [API Reference](https://distributhor.github.io/guacamole/) where the details of the specifications can be found.

## Quick Start

The following is a basic example, which will also give you a succinct idea of the types of things this tool aims to help with.

The two main classes that you will typically interface with, are:

- [ArangoDB](https://distributhor.github.io/guacamole/classes/index.ArangoDB.html): A thin wrapper around an `ArangoJS` [Database](https://arangodb.github.io/arangojs/8.1.0/classes/database.Database.html) instance. It provides direct and easy access to the ArangoJS instance itself, but also adds a few convenience methods, for optional use.
- [ArangoConnection](https://distributhor.github.io/guacamole/classes/index.ArangoConnection.html): A class that manages instances of [ArangoDB](https://distributhor.github.io/guacamole/classes/index.ArangoDB.html). An `ArangoDB` instance strictly deals with only one `ArangoJS` [Database](https://arangodb.github.io/arangojs/8.1.0/classes/database.Database.html). If you only need to work with one database, then simply use the `ArangoDB` class directly, but if you want to use different databases interchangeably in the same code, then `ArangoConnection` could potentially make that easier. The current limitation, however, is that it only manages multiple database connections (or instances) for the same `ArangoJS` [Config](https://arangodb.github.io/arangojs/8.1.0/types/connection.Config.html) credentials. In other words, you can easily (and only) work with multiple databases using the same shared configuration.

Actually, there is one more class that should be mentioned, namely [ArangoDBWithSauce](https://distributhor.github.io/guacamole/classes/index.ArangoDBWithSauce.html), which provides a little extra. But more about that further down.

Construct your instance ...

```javascript
// const { ArangoDB } = require('@distributhor/guacamole')
import { ArangoDB } from '@distributhor/guacamole'
import { aql } from 'arangojs/aql'

const db = new ArangoDB({
   databaseName: process.env.YOUR_DB_NAME,
   url: process.env.YOUR_DB_URL,
      auth: {
         username: process.env.YOUR_DB_USER,
         password: process.env.YOUR_DB_PASSWORD
     }
})
```

The configuration object passed into the constructor is a standard `ArangoJS` [Config](https://arangodb.github.io/arangojs/8.1.0/types/connection.Config.html) object. Alternatively, it also takes a [DatabaseConfig](https://distributhor.github.io/guacamole/interfaces/types.DatabaseConfig.html) object, which extends from the `ArangoJS` class, but provides some additional options for use with `Guacamole` functions. Lastly, the constructor will also accept an existing `ArangoJS` [Database](https://arangodb.github.io/arangojs/8.1.0/classes/database.Database.html) instance.

Then perform some operations ...

```javascript
// Fetch one result only, it will return the first match
// By default the the value is considered case insensitive
// Other than case, it will match on the exact value
const person = await fetchOneByPropertyValue(
   'users', 
   { 
      property: 'email', 
      value: 'someone@email.com' 
   }
)

// Fetch all results that matches the property value
// By default the the value is considered case insensitive
// Other than case, it will match on the exact value
const peopleNamedJoe = await fetchByPropertyValue(
   'users', 
   { 
      property: 'firstName', 
      value: 'joe' 
   }
)

// Fetch all results that matches the exact property value
// Stipulate that the match should be case sensitive
// Limit the result to 10 and sort by lastName property
const peopleNamedJoeV2 = await fetchByPropertyValue(
   'users', 
   { 
      property: 'firstName', 
      value: 'Joe',
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
// The terms are considered case insentitive and not exact,
// so will match values such as "Joey" and "William"
const peopleNamedJoeV3 = await fetchByCriteria(
   'users', 
   search: {
      props: 'name', terms: ['joe', 'wil']
   }
)

// Fetch all results where gender == 'M'
// AND the name matches anything containing "joe"
// Return the ArangoJS ArrayCursor instead of .all()
const peopleNamedJoeV4 = await fetchByPropertyValueAndCriteria(
   'users', 
   { 
      property: 'gender', 
      value: 'M' 
   }
   search: {
      props: 'name', terms: 'joe'
   },
   { 
      returnCursor: true
   }
)
```

## Table Of Contents

The documentation below does not replace the official [API Reference](https://distributhor.github.io/guacamole/) (which contains more detail), but it does provide a simple introduction and usage example for each function. The snippets without a checkmark still needs to be completed.

#### Native Driver, AQL & CRUD
- [x] [The native ArangoJS Driver](#The-native-ArangoJS-Driver)
- [x] [AQL Queries](#AQL-Queries)
- [ ][CRUD](#CRUD) (TODO)
- [ ][fetchProperty](#fetchProperty)
- [ ][updateProperty](#updateProperty)

#### Queries & Data Fetching

- [ ][fetchByProperties](#fetchByProperties)
- [ ][fetchByCriteria](#fetchByCriteria)
- [ ][fetchByPropertiesAndCriteria](#fetchByPropertiesAndCriteria)

#### Arrays
- [ ][addArrayValue](#addArrayValue)
- [ ][removeArrayValue](#removeArrayValue)
- [ ][addArrayObject](#addArrayObject)
- [ ][removeArrayObject](#removeArrayObject)
- [ ][updateArrayObject](#updateArrayObject)
- [ ][replaceArrayObject](#replaceArrayObject)
- [ ][replaceArray](#replaceArray)

#### Util

- [ ][trimDocuments](#trimDocuments)
- [ ][validateUniqueConstraint](#validateUniqueConstraint)

#### With Sauce

- [ ][fetchByPropertyValue](#fetchByPropertyValue)
- [ ][fetchByAnyPropertyValue](#fetchByAnyPropertyValue)
- [ ][fetchByAllPropertyValues](#fetchByAllPropertyValues)
- [ ][fetchOneByPropertyValue](#fetchOneByPropertyValue)
- [ ][fetchOneByAnyPropertyValue](#fetchOneByAnyPropertyValue)
- [ ][fetchOneByAllPropertyValues](#fetchOneByAllPropertyValues)
- [ ][fetchByPropertyValueAndCriteria](#fetchByPropertyValueAndCriteria)
- [ ][fetchByAnyPropertyValueAndCriteria](#fetchByAnyPropertyValueAndCriteria)
- [ ][fetchByAllPropertyValuesAndCriteria](#fetchByAllPropertyValuesAndCriteria)

### The native ArangoJS Driver

```javascript
const cursor = await db.driver.query(aql`FOR d IN user FILTER d.name LIKE ${name} RETURN d`)
```

The native `ArangoJS` driver is exposed on the `.driver` property of the `ArangoDB` class. By using `db.driver` you always have the full native capability available. Use as usual.

### AQL Queries

To perform an AQL query you can, of course, just run them using the native driver.

```javascript
const cursor = await db.driver.query(aql`FOR d IN user FILTER d.name LIKE ${name} RETURN d`)
```

But since it is used soo often, there is a shorthand for convenience.

```javascript
const cursor = await db.query(aql`FOR d IN user FILTER d.name LIKE ${name} RETURN d`)
```

This returns the standard `ArangoJS` cursor. If you simply want to return all results immediately, and not bother with the array cursor (equivalent to invoking `cursor.all()`, the usual warnings apply) ...

```javascript
const results = await db. queryAll(aql`FOR d IN user FILTER d.name LIKE ${name} RETURN d`)

for (const r of result) {
	console.log(r)
}
```

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
