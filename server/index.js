/* eslint-disable no-console */
import bcrypt from 'bcryptjs'
import chalk from 'chalk'
import fs from 'fs'
import { ApolloServer, gql } from 'apollo-server'
import express from 'express'
import helmet from 'helmet'
import {
  GraphQLDateTime,
} from 'graphql-iso-date'

import models, { User } from './models'

import verifyToken from './lib/verifyToken'

import registerIcalRoute from './routes/ical'

/* GraphQL Resolvers */
import authenticate from './resolvers/authenticate'
import me from './resolvers/me'
import createNewUser from './resolvers/createNewUser'
import updateUserPassword from './resolvers/updateUserPassword'
import events, {
  eventById,
  createNewEvent,
} from './resolvers/events'
import deleteUser from './resolvers/deleteUser'
import deleteEvent from './resolvers/deleteEvent'
import updateEvent from './resolvers/updateEvent'

import generateFakeEventsData from './scripts/fakeData'

import {
  createDefaultAdmin,
  defaultAdminPassword,
  populateWithTestData,
} from './config/config.json'

if (!fs.existsSync(`${__dirname}/config/secret`)) {
  throw new Error('No secret key file found. Please create one in ./config/secret and chmod to 400.')
}

const app = express()
const httpPort = 4001

const server = new ApolloServer({
  typeDefs: gql(fs.readFileSync(`${__dirname}/schema.graphql`, 'utf8')),
  resolvers: {
    Query: {
      authenticate,
      eventById,
      events,
      me,
    },
    Mutation: {
      createNewEvent,
      createNewUser,
      deleteEvent,
      deleteUser,
      updateEvent,
      updateUserPassword,
    },
    DateTime: GraphQLDateTime,
  },
  context: ({ req }) => {
    const token = req.headers.authorization || ''

    const user = verifyToken(token)

    return { user }
  },
  playground: {
    settings: {
      'editor.theme': 'light',
      'editor.fontSize': 18,
    },
  },
})

server.listen()
  .then(({ url }) => {
    console.log(`Server up on ${url} in ${process.env.NODE_ENV || 'development'} mode.`)
  })

models.sequelize.sync().then(() => {
  console.log(chalk.green(`[${chalk.bold('DB')}] Connection established.`))

  if (createDefaultAdmin) {
    User.findOne({
      where: { username: 'admin' },
      attributes: { exclude: ['password'] },
    })
      .then((user) => {
        if (!user) {
          const hashedPassword = bcrypt.hashSync(defaultAdminPassword, 8)

          User.create({
            username: 'admin',
            password: hashedPassword,
            roles: ['ADMIN'],
          })
            .then(() => {
              console.log(chalk.yellow('Default admin account doesn\'t exist. Creating it.'))
            })
        }
      })
  }

  if (populateWithTestData) {
    generateFakeEventsData(10)
  }
})

app.use(helmet())

registerIcalRoute(app)

app.listen(httpPort, () => console.log(`HTTP server up on ${httpPort}`))
