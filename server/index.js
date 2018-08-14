/* eslint-disable no-console */
import bcrypt from 'bcryptjs'
import chalk from 'chalk'
import fs from 'fs'
import { ApolloServer, gql } from 'apollo-server'

import models, { User } from './models'

import verifyToken from './lib/verifyToken'

/* GraphQL Resolvers */
import authenticate from './resolvers/authenticate'
import me from './resolvers/me'

import {
  createDefaultAdmin,
  defaultAdminPassword,
} from './config/config.json'

if (!fs.existsSync(`${__dirname}/config/secret`)) {
  throw new Error('No secret key file found. Please create one in ./config/secret and chmod to 400.')
}

const server = new ApolloServer({
  typeDefs: gql`
    type User {
      id: Int!,
      username: String!,
      createdAt: String,
      updatedAt: String,
    }

    type Query {
      authenticate(username: String!, password: String!): String!,
      me: User
    }
  `,
  resolvers: {
    Query: {
      authenticate,
      me,
    },
  },
  context: ({ req }) => {
    const token = req.headers.authorization || ''

    const user = verifyToken(token)

    return { user }
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
            administrator: true,
          })
            .then(() => {
              console.log(chalk.yellow('Default admin account doesn\'t exist. Creating it.'))
            })
        }
      })
  }
})
