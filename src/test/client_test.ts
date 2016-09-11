import {Server} from 'http';
import {expect} from 'chai';
import {Socket} from 'net';
import * as express from 'express';
import * as bodyParser from 'body-parser';

import {Client, ApiResponse, UserResponse, TeamResponse, TeamsResponse} from '../client';

const apiJsonParser = bodyParser.json({ type: 'application/vnd.api+json' });

interface ResponseWithSocket extends express.Response {
  socket: Socket;
}

interface RequestWithBody extends express.Request {
  body: any;
}

describe('Hack24 API Client', () => {

  describe('#checkApi', () => {

    describe('when request succeeds', () => {

      let server: Server;
      let response: ApiResponse;

      before((done) => {
        process.env.HACK24API_URL = 'http://localhost:12345'
        const api = express();

        api.get('/api', (req: express.Request, res: express.Response) => {
          res.sendStatus(200);
        });

        const client = new Client();

        server = api.listen(12345, () => {
          client.checkApi()
            .then((res) => {
              response = res;
              done();
            })
            .catch(done);
        });
      });

      after((done) => {
        server.close(done);
      });

      it('should resolve with status code 200 OK', () => {
        expect(response.statusCode).to.equal(200);
      });

      it('should resolve with OK', () => {
        expect(response.ok).to.be.true;
      });
    });

    describe('when request errors', () => {

      let server: Server;
      let response: ApiResponse;
      let error: any;

      before((done) => {
        process.env.HACK24API_URL = 'http://localhost:12345'

        const api = express();

        api.use((req: express.Request, res: express.Response) => {
          (<ResponseWithSocket>res).socket.destroy();
        });

        const client = new Client();

        server = api.listen(12345, () => {
          client.checkApi()
            .then(() => {
              done(new Error('Promise resolved'));
            })
            .catch((err) => {
              error = err;
              done();
            });
        });
      });

      after((done) => {
        server.close(done);
      });

      it('should reject with an error', () => {
        expect(error.message).to.equal('socket hang up');
      });
    });

    describe('#createTeam', () => {

      describe('when request succeeds', () => {

        let server: Server;
        let teamName: string;
        let userId: string;
        let expectedAuth: string;
        let contentType: string | string[];
        let accept: string | string[];
        let authorization: string | string[];
        let body: any;
        let response: ApiResponse;

        before((done) => {
          process.env.HACK24API_URL = 'http://localhost:12345';
          const pass = process.env.HACKBOT_PASSWORD = '65456465464654';

          const api = express();

          teamName = 'Pineapple Express'
          userId = 'U12345'
          const email_address = 'someguy.com'

          expectedAuth = `Basic ${new Buffer(`${email_address}:${pass}`).toString('base64')}`

          api.post('/teams', apiJsonParser, (req: RequestWithBody, res: express.Response) => {
            contentType = req.headers['content-type'];
            accept = req.headers['accept'];
            authorization = req.headers['authorization'];
            body = req.body;
            res.sendStatus(201);
          });

          const client = new Client();

          server = api.listen(12345, () => {
            client.createTeam(teamName, userId, email_address)
              .then((res) => {
                response = res;
                done();
              })
              .catch(done);
          });

          after((done) => {
            server.close(done);
          });

          it('should resolve with status code 201 Created', () => {
            expect(response.statusCode).to.equal(201);
          });

          it('should resolve with OK', () => {
            expect(response.ok).to.be.true;
          });

          it('should request with accept application/vnd.api+json', () => {
            expect(accept).to.equal('application/vnd.api+json');
          });

          it('should request with content-type application/vnd.api+json', () => {
            expect(contentType).to.equal('application/vnd.api+json');
          });

          it('should request with the expected authorization', () => {
            expect(authorization).to.equal(expectedAuth);
          });

          it('should request to create the expected team', () => {
            expect(body.data.type).to.equal('teams')
            expect(body.data.attributes.name).to.equal(teamName);
          });

          it('should request to add the user relationship', () => {
            expect(body.data.relationships.members.data.length).to.equal(1)
            expect(body.data.relationships.members.data[0].type).to.equal('users')
            expect(body.data.relationships.members.data[0].id).to.equal(userId);
          });
        });
      });
    });

    describe('when team exists', () => {

      let server: Server;
      let result: ApiResponse;

      before((done) => {
        process.env.HACK24API_URL = 'http://localhost:12345'

        const api = express();

        api.post('/teams', apiJsonParser, (req: express.Request, res: express.Response) => {
          res.sendStatus(409);
        });

        const client = new Client();

        server = api.listen(12345, () => {
          client.createTeam('Pineapple Express', 'U12345', undefined)
            .then((res) => {
              result = res;
              done()
            })
            .catch(done);
        });
      });

      after((done) => {
        server.close(done);
      });

      it('should resolve with status code 409 Conflict', () => {
        expect(result.statusCode).to.equal(409)
      });

      it('should resolve with not OK', () => {
        expect(result.ok).to.be.false
      });
    });

    describe('when request errors', () => {

      let server: Server;
      let error: Error;

      before((done) => {
        process.env.HACK24API_URL = 'http://localhost:12345'

        const api = express()

        api.post('/teams', (req: express.Request, res: ResponseWithSocket) => {
          res.socket.destroy();
        });

        const client = new Client();

        server = api.listen(12345, () => {
          client.createTeam('some team', 'some user', undefined)
            .then(() => {
              done(new Error('Promise resolved'));
            })
            .catch((err) => {
              error = err;
              done()
            });
        });
      });

      after((done) => {
        server.close(done);
      });

      it('should reject with an error', () => {
        expect(error.message).to.equal('socket hang up');
      });
    });
  });

  describe('#getUser', () => {

    describe('when user exists and in a team', () => {

      let server: Server;
      let accept: string | string[];
      let userId: string;
      let userName: string;
      let teamId: string;
      let teamName: string;
      let otherUserId: string;
      let otherUserName: string;
      let result: UserResponse;

      before((done) => {
        process.env.HACK24API_URL = 'http://localhost:12345';

        const api = express();

        userId = 'U12345';
        userName = 'Barry';
        teamId = 'clicky-keys';
        teamName = 'Clicky Keys';
        otherUserId = 'U67890';
        otherUserName = 'Zackary';

        api.get(`/users/${userId}`, (req: express.Request, res: express.Response) => {
          accept = req.headers['accept'];
          res.status(200).json({
            data: {
              type: 'users',
              id: userId,
              attributes: {
                name: userName
              },
              relationships: {
                team: {
                  data: {
                    type: 'teams',
                    id: teamId
                  }
                }
              }
            },
            included: [
              {
                type: 'teams',
                id: teamId,
                attributes: {
                  name: teamName
                },
                relationships: {
                  members: {
                    data: [{
                      type: 'users',
                      id: userId
                    }, {
                        type: 'users',
                        id: otherUserId
                      }]
                  }
                }
              },
              {
                type: 'users',
                id: otherUserId,
                attributes: {
                  name: otherUserName
                },
                relationships: {
                  team: {
                    data: {
                      type: 'teams',
                      id: teamId
                    }
                  }
                }
              }
            ]
          });
        });

        const client = new Client();

        server = api.listen(12345, () => {
          client.getUser(userId)
            .then((res) => {
              result = res;
              done();
            })
            .catch(done);
        });
      })

      after((done) => {
        server.close(done);
      });

      it('should resolve with status code 200 OK', () => {
        expect(result.statusCode).to.equal(200)
      });

      it('should resolve with OK', () => {
        expect(result.ok).to.be.true
      });

      it('should request with accept application/vnd.api+json', () => {
        expect(accept).to.equal('application/vnd.api+json')
      });

      it('should return the expected user', () => {
        expect(result.user.id).to.equal(userId);
        expect(result.user.name).to.equal(userName);
      });

      it('should return the expected team relationship', () => {
        expect(result.user.team.id).to.equal(teamId)
        expect(result.user.team.name).to.equal(teamName)
        expect(result.user.team.members.length).to.equal(2)
        expect(result.user.team.members[0].id).to.equal(userId)
        expect(result.user.team.members[0].name).to.equal(userName)
        expect(result.user.team.members[1].id).to.equal(otherUserId)
        expect(result.user.team.members[1].name).to.equal(otherUserName)
      });
    });

    describe('when user exists and not in a team', () => {

      let server: Server;
      let userId: string;
      let userName: string;
      let accept: string | string[];
      let result: UserResponse;

      before((done) => {
        process.env.HACK24API_URL = 'http://localhost:12345'

        const api = express()

        userId = 'U12345'
        userName = 'Barry'

        api.get(`/users/${userId}`, (req: express.Request, res: express.Response) => {
          accept = req.headers['accept']
          res.status(200).json({
            data: {
              type: 'users',
              id: userId,
              attributes: {
                name: userName
              },
              relationships: {
                team: {
                  data: null
                }
              }
            }
          });
        });

        const client = new Client();

        server = api.listen(12345, () => {
          client.getUser(userId)
            .then((res) => {
              result = res;
              done()
            })
            .catch(done);
        });
      });

      after((done) => {
        server.close(done);
      });

      it('should resolve with status code 200 OK', () => {
        expect(result.statusCode).to.equal(200)
      });

      it('should resolve with OK', () => {
        expect(result.ok).to.be.true
      });

      it('should request with accept application/vnd.api+json', () => {
        expect(accept).to.equal('application/vnd.api+json')
      });

      it('should return the expected user', () => {
        expect(result.user.id).to.equal(userId)
        expect(result.user.name).to.equal(userName)
      });

      it('should return a null team', () => {
        expect(result.user.team).to.equal(null)
      });
    });

    describe('when user does not exist', () => {

      let server: Server;
      let result: UserResponse;

      before((done) => {
        process.env.HACK24API_URL = 'http://localhost:12345'

        const api = express()

        api.get('/users/some_guy', (req: express.Request, res: express.Response) => {
          res.status(404).json({
            errors: [{
              status: '404',
              title: 'Resource not found.'
            }]
          });
        });

        const client = new Client();

        server = api.listen(12345, () => {
          client.getUser('U12345')
            .then((res) => {
              result = res;
              done()
            })
            .catch(done);
        });
      });

      after((done) => {
        server.close(done);
      });

      it('should resolve with status code 404 Not Found', () => {
        expect(result.statusCode).to.equal(404);
      });

      it('should resolve with not OK', () => {
        expect(result.ok).to.be.false;
      });

      it('should resolve without setting the user', () => {
        expect(result.user).to.equal(undefined)
      });
    });

    describe('when request errors', () => {

      let server: Server;
      let error: Error;

      before((done) => {
        process.env.HACK24API_URL = 'http://localhost:12345'

        const api = express()

        api.get('/users/:userId', (req: express.Request, res: ResponseWithSocket) => {
          res.socket.destroy();
        });

        const client = new Client();

        server = api.listen(12345, () => {
          client.getUser('some user')
            .then(() => {
              done(new Error('Promise resolved'));
            })
            .catch((err) => {
              error = err;
              done()
            })
        });
      });

      after((done) => {
        server.close(done);
      });

      it('should reject with an error', () => {
        expect(error.message).to.equal('socket hang up');
      });
    });
  });

  describe('#getTeam', () => {

    describe('when team exists', () => {

      let server: Server;
      let teamId: string;
      let teamName: string;
      let firstUserId: string;
      let firstUserName: string;
      let secondUserId: string;
      let secondUserName: string;
      let accept: string | string[];
      let result: TeamResponse;

      before((done) => {
        process.env.HACK24API_URL = 'http://localhost:12345';

        const api = express()

        teamId = 'clicky-keys'
        teamName = 'Clicky Keys'
        firstUserId = 'U12345'
        firstUserName = 'Barry'
        secondUserId = 'U67890'
        secondUserName = 'Zackary'

        api.get(`/teams/${teamId}`, (req: express.Request, res: express.Response) => {
          accept = req.headers['accept']
          res.status(200).json({
            data: {
              type: 'teams',
              id: teamId,
              attributes: { name: teamName },
              relationships: {
                members: {
                  data: [{
                    type: 'users',
                    id: firstUserId
                  }, {
                      type: 'users',
                      id: secondUserId
                    }]
                }
              }
            },
            included: [{
              type: 'users',
              id: firstUserId,
              attributes: { name: firstUserName },
              relationships: {
                team: {
                  data: {
                    type: 'teams',
                    id: teamId
                  }
                }
              }
            }, {
                type: 'users',
                id: secondUserId,
                attributes: { name: secondUserName },
                relationships: {
                  team: {
                    data: {
                      type: 'teams',
                      id: teamId
                    }
                  }
                }
              }]
          });
        });

        const client = new Client();

        server = api.listen(12345, () => {
          client.getTeam(teamId)
            .then((res) => {
              result = res;
              done();
            })
            .catch(done);
        });
      });

      after((done) => {
        server.close(done);
      });

      it('should resolve with status code 200 OK', () => {
        expect(result.statusCode).to.equal(200);
      });

      it('should resolve with OK', () => {
        expect(result.ok).to.be.true;
      });

      it('should request with accept application/vnd.api+json', () => {
        expect(accept).to.equal('application/vnd.api+json');
      });

      it('should return the expected team', () => {
        expect(result.team.id).to.equal(teamId)
        expect(result.team.name).to.equal(teamName);
      });

      it('should return the expected members relationships', () => {
        expect(result.team.members.length).to.equal(2)
        expect(result.team.members[0].id).to.equal(firstUserId)
        expect(result.team.members[0].name).to.equal(firstUserName)
        expect(result.team.members[1].id).to.equal(secondUserId)
        expect(result.team.members[1].name).to.equal(secondUserName);
      });
    });

    describe('when team does not exist', () => {

      let server: Server;
      let result: TeamResponse;

      before((done) => {
        process.env.HACK24API_URL = 'http://localhost:12345'

        const api = express()

        api.get('/teams/:teamId', (req: express.Request, res: express.Response) => {
          res.status(404).json({
            errors: [{
              status: '404',
              title: 'Resource not found.'
            }]
          });
        });

        const client = new Client();

        server = api.listen(12345, () => {
          client.getTeam('some team')
            .then((res) => {
              result = res;
              done();
            })
            .catch(done);
        });
      });

      after((done) => {
        server.close(done);
      });

      it('should resolve with status code 404 Not Found', () => {
        expect(result.statusCode).to.equal(404);
      });

      it('should resolve with not OK', () => {
        expect(result.ok).to.be.false;
      });

      it('should resolve without setting the team', () => {
        expect(result.team).to.equal(undefined);
      });
    });

    describe('when http error', () => {

      let server: Server;
      let error: Error;

      before((done) => {
        process.env.HACK24API_URL = 'http://localhost:12345'

        const api = express()

        api.get('/teams/:teamId', (req: express.Request, res: ResponseWithSocket) => {
          res.socket.destroy();
        });

        const client = new Client();

        server = api.listen(12345, () => {
          client.getTeam('some user')
            .then(() => {
              done(new Error('Promise resolved'));
            })
            .catch((err) => {
              error = err;
              done();
            });
        });
      });

      after((done) => {
        server.close(done);
      });

      it('should reject with an error', () => {
        expect(error.message).to.equal('socket hang up');
      });
    });
  });

  describe('#createUser', () => {

    describe('when created successfully', () => {

      let server: Server;
      let pass: string;
      let userId: string;
      let userName: string;
      let expectedAuth: string;
      let contentType: string | string[];
      let accept: string | string[];
      let authorization: string | string[];
      let body: any;
      let result: ApiResponse;

      before((done) => {
        process.env.HACK24API_URL = 'http://localhost:12345';
        pass = process.env.HACKBOT_PASSWORD = 'slkjfsjkfjks';

        const api = express();

        userId = 'U12345';
        userName = 'Pineapple Express';
        const email_address = 'lkjasdkljasdgfhjdgf.daskjd';

        expectedAuth = `Basic ${new Buffer(`${email_address}:${pass}`).toString('base64')}`;

        api.post('/users', apiJsonParser, (req: RequestWithBody, res: express.Response) => {
          contentType = req.headers['content-type'];
          accept = req.headers['accept'];
          authorization = req.headers['authorization'];
          body = req.body;
          res.sendStatus(201);
        });

        const client = new Client();

        server = api.listen(12345, () => {
          client.createUser(userId, userName, email_address)
            .then((res) => {
              result = res;
              done()
            })
            .catch(done);
        });
      });

      after((done) => {
        server.close(done);
      });

      it('should resolve with status code 201 Created', () => {
        expect(result.statusCode).to.equal(201);
      });

      it('should resolve with OK', () => {
        expect(result.ok).to.be.true;
      });

      it('should request with accept application/vnd.api+json', () => {
        expect(accept).to.equal('application/vnd.api+json');
      });

      it('should request with content-type application/vnd.api+json', () => {
        expect(contentType).to.equal('application/vnd.api+json');
      });

      it('should request with the expected authorization', () => {
        expect(authorization).to.equal(expectedAuth);
      });

      it('should request to create the expected user', () => {
        expect(body.data.type).to.equal('users')
        expect(body.data.id).to.equal(userId)
        expect(body.data.attributes.name).to.equal(userName);
      });
    });

    describe('when user exists', () => {

      let server: Server;
      let result: ApiResponse;

      before((done) => {
        process.env.HACK24API_URL = 'http://localhost:12345'

        const api = express()

        api.post('/users', apiJsonParser, (req: express.Request, res: express.Response) => {
          res.status(409).json({
            errors: [{
              status: '409',
              title: 'Resource ID already exists.'
            }]
          });
        });

        const client = new Client();

        server = api.listen(12345, () => {
          client.createUser('raghght', 'Alien Race', undefined)
            .then((res) => {
              result = res;
              done()
            })
            .catch(done);
        });
      });

      after((done) => {
        server.close(done);
      });

      it('should resolve with status code 409 Conflict', () => {
        expect(result.statusCode).to.equal(409);
      });

      it('should resolve with not OK', () => {
        expect(result.ok).to.be.false;
      });
    });

    describe('when request errors', () => {

      let server: Server;
      let error: Error;

      before((done) => {
        process.env.HACK24API_URL = 'http://localhost:12345'

        const api = express()

        api.use((req: express.Request, res: ResponseWithSocket) => {
          res.socket.destroy();
        });

        const client = new Client();

        server = api.listen(12345, () => {
          client.createUser('some user', undefined, undefined)
            .then(() => {
              done(new Error('Promise resolved'));
            })
            .catch((err) => {
              error = err;
              done();
            });
        });
      });

      after((done) => {
        server.close(done);
      });

      it('should reject with an error', () => {
        expect(error.message).to.equal('socket hang up');
      });
    });
  });

  describe('#removeTeamMember', () => {

    describe('when request succeeds', () => {

      let server: Server;
      let teamId: string;
      let userId: string;
      let expectedAuth: string;
      let contentType: string | string[];
      let accept: string | string[];
      let authorization: string | string[];
      let body: any;
      let result: ApiResponse;

      before((done) => {
        process.env.HACK24API_URL = 'http://localhost:12345'
        const pass = process.env.HACKBOT_PASSWORD = 'sky'

        const api = express()

        teamId = 'swan-song'
        userId = 'U12345'
        const emailAddress = 'asdasasd0-9098'

        expectedAuth = `Basic ${new Buffer(`${emailAddress}:${pass}`).toString('base64')}`

        api.delete(`/teams/${teamId}/members`, apiJsonParser, (req: RequestWithBody, res: express.Response) => {
          contentType = req.headers['content-type']
          accept = req.headers['accept']
          authorization = req.headers['authorization']
          body = req.body
          res.sendStatus(204);
        });

        const client = new Client();

        server = api.listen(12345, () => {
          client.removeTeamMember(teamId, userId, emailAddress)
            .then((res) => {
              result = res;
              done();
            })
            .catch(done);
        });
      });

      after((done) => {
        server.close(done);
      });

      it('should resolve with status code 204 No Content', () => {
        expect(result.statusCode).to.equal(204);
      });

      it('should resolve with OK', () => {
        expect(result.ok).to.be.true;
      });

      it('should request with accept application/vnd.api+json', () => {
        expect(accept).to.equal('application/vnd.api+json');
      });

      it('should request with content-type application/vnd.api+json', () => {
        expect(contentType).to.equal('application/vnd.api+json');
      });

      it('should request with the expected authorization', () => {
        expect(authorization).to.equal(expectedAuth);
      });

      it('should request only one resource object to be removed', () => {
        expect(body.data.length).to.equal(1);
      });

      it('should request that a user be removed', () => {
        expect(body.data[0].type).to.equal('users');
      });

      it('should request the expected user to be removed', () => {
        expect(body.data[0].id).to.equal(userId);
      });
    });

    describe('when request errors', () => {

      let server: Server;
      let error: Error;

      before((done) => {
        process.env.HACK24API_URL = 'http://localhost:12345'

        const api = express()

        api.use((req: express.Request, res: ResponseWithSocket) => {
          res.socket.destroy();
        });

        const client = new Client();

        server = api.listen(12345, () => {
          client.removeTeamMember('some team', 'some user', undefined)
            .then(() => {
              done(new Error('Promise resolved'));
            })
            .catch((err) => {
              error = err;
              done()
            });
        });
      });

      after((done) => {
        server.close(done);
      });

      it('should reject with an error', () => {
        expect(error.message).to.equal('socket hang up');
      });
    });
  });


  describe('#findTeams', () => {

    describe('when teams found', () => {

      let server: Server;
      let accept: string | string[];
      let filterNameValue: string;
      let result: TeamsResponse;
      let firstTeam: { id: string; name: string; };
      let secondTeam: { id: string; name: string; };

      before((done) => {
        process.env.HACK24API_URL = 'http://localhost:12345'

        const api = express()

        const filter = 'hacking hack'
        firstTeam = {
          id: 'hack-hackers-hacking-hacks',
          name: 'Hack Hackers Hacking Hacks'
        };
        secondTeam = {
          id: 'hackers-hacking-hack-hacks',
          name: 'Hackers Hacking Hack Hacks'
        };

        api.get('/teams', (req: express.Request, res: express.Response) => {
          accept = req.headers['accept']
          filterNameValue = req.query.filter.name
          res.status(200).json({
            data: [{
              type: 'teams',
              id: firstTeam.id,
              attributes: { name: firstTeam.name }
            }, {
                type: 'teams',
                id: secondTeam.id,
                attributes: { name: secondTeam.name }
              }]
          });
        });

        const client = new Client();

        server = api.listen(12345, () => {
          client.findTeams(filter)
            .then((res) => {
              result = res;
              done();
            })
            .catch(done);
        });
      });

      after((done) => {
        server.close(done);
      });

      it('should resolve with status code 200 OK', () => {
        expect(result.statusCode).to.equal(200);
      });

      it('should resolve with OK', () => {
        expect(result.ok).to.be.true;
      });

      it('should request with accept application/vnd.api+json', () => {
        expect(accept).to.equal('application/vnd.api+json');
      });

      it('should return two teams', () => {
        expect(result.teams.length).to.equal(2);
      });

      it('should return both teams', () => {
        expect(result.teams[0].id).to.equal(firstTeam.id)
        expect(result.teams[0].name).to.equal(firstTeam.name)
        expect(result.teams[1].id).to.equal(secondTeam.id)
        expect(result.teams[1].name).to.equal(secondTeam.name);
      });
    });

    describe('when http error', () => {

      let server: Server;
      let error: Error;

      before((done) => {
        process.env.HACK24API_URL = 'http://localhost:12345'

        const api = express()

        api.get('/teams', (req: express.Request, res: ResponseWithSocket) => {
          res.socket.destroy();
        });

        const client = new Client();

        server = api.listen(12345, () => {
          client.findTeams('some filter')
            .then(() => {
              done(new Error('Promise resolved'));
            })
            .catch((err) => {
              error = err;
              done();
            });
        });

        after((done) => {
          server.close(done);
        });

        it('should reject with an error', () => {
          expect(error.message).to.equal('socket hang up');
        });
      });
    });
  });

  describe('#addUserToTeam', () => {

    describe('when succeeds', () => {

      let server: Server;
      let userId: string;
      let userName: string;
      let teamId: string;
      let expectedAuth: string;
      let contentType: string | string[];
      let accept: string | string[];
      let authorization: string | string[];
      let body: any;
      let teamIdParam: string;
      let result: ApiResponse;

      before((done) => {
        process.env.HACK24API_URL = 'http://localhost:12345';
        const pass = process.env.HACKBOT_PASSWORD = 'slkjfsjkfjks';

        const api = express();

        userId = 'U12345';
        userName = 'Pineapple Dicxpress';
        teamId = 'fruity';
        const email_address = 'lkjasdkljasdgfhjdgf.daskjd';

        expectedAuth = `Basic ${new Buffer(`${email_address}:${pass}`).toString('base64')}`;

        api.post('/teams/:teamId/members', apiJsonParser, (req: RequestWithBody, res: express.Response) => {
          contentType = req.headers['content-type'];
          accept = req.headers['accept'];
          authorization = req.headers['authorization'];
          body = req.body;
          teamIdParam = req.params['teamId'];
          res.sendStatus(201);
        });

        const client = new Client();

        server = api.listen(12345, () => {
          client.addUserToTeam(teamId, userId, email_address)
            .then((res) => {
              result = res;
              done();
            })
            .catch(done);
        });
      });

      after((done) => {
        server.close(done);
      });

      it('should resolve with status code 201 Created', () => {
        expect(result.statusCode).to.equal(201);
      });

      it('should resolve with OK', () => {
        expect(result.ok).to.be.true;
      });

      it('should request with accept application/vnd.api+json', () => {
        expect(accept).to.equal('application/vnd.api+json');
      });

      it('should request with content-type application/vnd.api+json', () => {
        expect(contentType).to.equal('application/vnd.api+json');
      });

      it('should request with the expected authorization', () => {
        expect(authorization).to.equal(expectedAuth);
      });

      it('should request with the expected team ID', () => {
        expect(teamIdParam).to.equal(teamId);
      });

      it('should request to create the expected user', () => {
        expect(body.data[0].type).to.equal('users');
        expect(body.data[0].id).to.equal(userId);
      });
    });

    describe('when request errors', () => {

      let server: Server;
      let error: Error;

      before((done) => {
        process.env.HACK24API_URL = 'http://localhost:12345'

        const api = express();

        api.use((req: express.Request, res: ResponseWithSocket) => {
          res.socket.destroy();
        });

        const client = new Client();

        server = api.listen(12345, () => {
          client.addUserToTeam('some team', 'some user', 'some email')
            .then(() => {
              done(new Error('Promise resolved'));
            })
            .catch((err) => {
              error = err;
              done();
            });
        });
      });

      after((done) => {
        server.close(done);
      });

      it('should reject with an error', () => {
        expect(error.message).to.equal('socket hang up');
      });
    });
  });

  describe('#updateMotto', () => {

    describe('when team exists', () => {

      let server: Server;
      let motto: string;
      let teamId: string;
      let expectedAuth: string;
      let contentType: string | string[];
      let accept: string | string[];
      let authorization: string | string[];
      let body: any;
      let teamIdParam: string;
      let result: ApiResponse;

      before((done) => {
        process.env.HACK24API_URL = 'http://localhost:12345'
        const pass = process.env.HACKBOT_PASSWORD = 'slkjfsjkfjks'

        const api = express();

        motto = 'No TV and no beer make Homer something something'
        teamId = 'duff'
        const email_address = 'lkjasdkljasdgfhjdgf.daskjd'

        expectedAuth = `Basic ${new Buffer(`${email_address}:${pass}`).toString('base64')}`

        api.patch('/teams/:teamId', apiJsonParser, (req: RequestWithBody, res: express.Response) => {
          contentType = req.headers['content-type']
          accept = req.headers['accept']
          authorization = req.headers['authorization']
          body = req.body
          teamIdParam = req.params['teamId']
          res.sendStatus(204);
        });

        const client = new Client();

        server = api.listen(12345, () => {
          client.updateMotto(motto, teamId, email_address)
            .then((res) => {
              result = res;
              done()
            })
            .catch(done);
        });
      });

      after((done) => {
        server.close(done);
      });

      it('should resolve with status code 204 No Content', () => {
        expect(result.statusCode).to.equal(204);
      });

      it('should resolve with OK', () => {
        expect(result.ok).to.be.true;
      });

      it('should request with accept application/vnd.api+json', () => {
        expect(accept).to.equal('application/vnd.api+json');
      });

      it('should request with content-type application/vnd.api+json', () => {
        expect(contentType).to.equal('application/vnd.api+json');
      });

      it('should request with the expected authorization', () => {
        expect(authorization).to.equal(expectedAuth);
      });

      it('should request with the expected team ID', () => {
        expect(teamIdParam).to.equal(teamId);
      });

      it('should request to update the expected team', () => {
        expect(body.data.type).to.equal('teams')
        expect(body.data.id).to.equal(teamId);
      });
    });

    describe('when team not found', () => {

      let server: Server;
      let result: ApiResponse;

      before((done) => {
        process.env.HACK24API_URL = 'http://localhost:12345'
        const pass = process.env.HACKBOT_PASSWORD = 'slkjfsjkfjks'

        const api = express()

        const email_address = 'lkjasdkljasdgfhjdgf.daskjd'

        api.patch('/teams/:teamId', apiJsonParser, (req: express.Request, res: express.Response) => {
          res.sendStatus(404);
        });

        const client = new Client();

        server = api.listen(12345, () => {
          client.updateMotto('chips', 'fish', 'alkjdajhsfdsdf.co.uk')
            .then((res) => {
              result = res;
              done()
            })
            .catch(done);
        });
      });

      after((done) => {
        server.close(done);
      });

      it('should resolve with status code 404 Not Found', () => {
        expect(result.statusCode).to.equal(404);
      });

      it('should resolve with not OK', () => {
        expect(result.ok).to.be.false;
      });
    });

    describe('when request errors', () => {

      let server: Server;
      let error: Error;

      before((done) => {
        process.env.HACK24API_URL = 'http://localhost:12345'

        const api = express()

        api.use((req: express.Request, res: ResponseWithSocket) => {
          res.socket.destroy()
        });

        const client = new Client();

        server = api.listen(12345, () => {
          client.updateMotto('some motto', 'some team id', 'some email address')
            .then(() => {
              done(new Error('Promise resolved'));
            })
            .catch((err) => {
              error = err;
              done()
            });
        });
      });

      after((done) => {
        server.close(done);
      });

      it('should reject with an error', () => {
        expect(error.message).to.equal('socket hang up');
      });
    });
  });
});