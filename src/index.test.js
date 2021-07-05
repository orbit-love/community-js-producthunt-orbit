const OrbitProductHunt = require('./index')

describe('OrbitProductHunt constructor', () => {
  it('given all credentials, does not throw', () => {
    const sut = new OrbitProductHunt('1', '2', '3', '4')
    expect(sut).not.toBeNull()
  })

  it('given missing configuration values, throws', () => {
    delete process.env.ORBIT_WORKSPACE_ID
    delete process.env.ORBIT_API_KEY
    delete process.env.PRODUCT_HUNT_API_KEY
    delete process.env.PRODUCT_HUNT_API_SECRET

    expect(() => {
      new OrbitProductHunt(null, null, null, null)
    }).toThrow()
  })

  it('configuration read from env variables when not directly provided', () => {
    process.env.ORBIT_WORKSPACE_ID = '1'
    process.env.ORBIT_API_KEY = '2'
    process.env.PRODUCT_HUNT_API_KEY = '3'
    process.env.PRODUCT_HUNT_API_SECRET = '4'

    const sut = new OrbitProductHunt(null, null, null, null)

    expect(sut.productHunt.credentials.client_id).toBe('3')
    expect(sut.productHunt.credentials.client_secret).toBe('4')
  })

  it('sets productHunt credentials', () => {
    const sut = new OrbitProductHunt('1', '2', '3', '4')

    expect(sut.productHunt.credentials.client_id).toBe('3')
    expect(sut.productHunt.credentials.client_secret).toBe('4')
    expect(sut.productHunt.credentials.grant_type).toBe('client_credentials')
  })

  it('sets orbit credentials', () => {
    const sut = new OrbitProductHunt('1', '2', '3', '4')

    expect(sut.orbit.credentials.orbitWorkspaceId).toBe('1')
    expect(sut.orbit.credentials.orbitApiKey).toBe('2')
  })
})

describe('OrbitProductHunt getProducts', () => {
  let sut
  beforeEach(() => {
    sut = new OrbitProductHunt('1', '2', '3', '4')
  })

  it('given one item, maps item data to results array', async () => {
    whenProductHuntReturns([
      {
        name: 'my product',
        id: '123'
      }
    ])

    const response = await sut.getProducts(123)

    expect(response[0].name).toBe('my product')
    expect(response[0].id).toBe('123')
  })

  it('given multiple items, correct number of items in results', async () => {
    whenProductHuntReturns([
      {
        name: 'my product1',
        id: '123'
      },
      {
        name: 'my product2',
        id: '456'
      }
    ])

    const response = await sut.getProducts(123)

    expect(response.length).toBe(2)
  })

  it('when productHunt errors, returns underlying error', async () => {
    sut.productHunt.users.show = (id, callback) => {
      callback('This is an error', null)
    }

    expect(async () => {
      await sut.getProducts(123)
    }).rejects.toMatch('This is an error')
  })

  function whenProductHuntReturns(responseData) {
    sut.productHunt.users.show = (id, callback) => {
      const stubbedResponse = {
        user: {
          maker_of: responseData
        }
      }

      const asString = JSON.stringify(stubbedResponse)
      const responseObject = {
        body: asString
      }

      callback(null, responseObject)
    }
  }
})

describe('OrbitProductHunt getVotesPage', () => {
  let sut
  beforeEach(() => {
    sut = new OrbitProductHunt('1', '2', '3', '4')
  })

  it('given votes from api, return values', async () => {
    whenVotePageReturns([
      {
        id: 123,
        user: {
          id: 456
        }
      }
    ])

    const response = await sut.getVotesPage(123)

    expect(response[0].id).toBe(123)
    expect(response[0].user.id).toBe(456)
  })

  it('when productHunt.votes.index fails, return underlying error', async () => {
    sut.productHunt.votes.index = (id, callback) => {
      callback('This is an error', null)
    }

    expect(async () => {
      await sut.getVotesPage(123)
    }).rejects.toMatch('This is an error')
  })

  function whenVotePageReturns(returnedVotes) {
    sut.productHunt.votes.index = (apiParams, callback) => {
      const stubbedResponse = {
        votes: returnedVotes
      }
      const asString = JSON.stringify(stubbedResponse)
      const responseObject = {
        body: asString
      }

      callback(null, responseObject)
    }
  }
})

describe('OrbitProductHunt getVotes', () => {
  let sut
  beforeEach(() => {
    sut = new OrbitProductHunt('1', '2', '3', '4')
  })

  it('single page of data, returns data from page', async () => {
    const queuedResponses = [
      [
        {
          id: 23642909,
          user_id: 2331178
        }
      ]
    ]

    sut.getVotesPage = () => {
      return queuedResponses.shift()
    }

    const response = await sut.getVotes(123)

    expect(response.length).toBe(1)
  })

  it('when there are multiple pages, returns all pages as one response', async () => {
    const queuedResponses = [
      [
        {
          id: 23642909,
          user_id: 2331178
        }
      ],
      [
        {
          id: 23642908,
          user_id: 2331578
        }
      ],
      []
    ]

    sut.getVotesPage = () => {
      return queuedResponses.shift()
    }

    const response = await sut.getVotes(123)

    expect(response.length).toBe(2)
  })
})

describe('OrbitProductHunt prepareVotes', () => {
  let sut
  beforeEach(() => {
    sut = new OrbitProductHunt('1', '2', '3', '4')
  })

  it('given a null value, returns empty array', () => {
    const input = null
    const output = sut.prepareVotes(input)
    expect(output.length).toBe(0)
  })

  it('given an empty array, returns empty array', () => {
    const input = []
    const output = sut.prepareVotes(input)
    expect(output.length).toBe(0)
  })

  it('given only-new items, returns all items', () => {
    const input = [
      {
        id: 123,
        created_at: dateXMinsAgo(3),
        user_id: 456,
        post_id: 789,
        user: {
          id: 456,
          username: 'joebloggs',
          twitter_username: 'twitter_username',
          profile_url: 'https://www.producthunt.com/example'
        }
      },
      {
        id: 123,
        created_at: dateXMinsAgo(5),
        user_id: 456,
        post_id: 789,
        user: {
          id: 456,
          username: 'joebloggs',
          twitter_username: 'twitter_username',
          profile_url: 'https://www.producthunt.com/example'
        }
      }
    ]

    const output = sut.prepareVotes(input)
    expect(output.length).toBe(2)
  })

  it('given some old items, returns only new items', () => {
    const input = [
      {
        id: 123,
        created_at: dateXMinsAgo(65),
        user_id: 456,
        post_id: 789,
        user: {
          id: 456,
          username: 'joebloggs',
          twitter_username: 'twitter_username',
          profile_url: 'https://www.producthunt.com/example'
        }
      },
      {
        id: 123,
        created_at: dateXMinsAgo(5),
        user_id: 456,
        post_id: 789,
        user: {
          id: 456,
          username: 'joebloggs',
          twitter_username: 'twitter_username',
          profile_url: 'https://www.producthunt.com/example'
        }
      }
    ]

    const output = sut.prepareVotes(input)
    expect(output.length).toBe(1)
  })

  it('given array, new object structure is correct', () => {
    const input = [
      {
        id: 123,
        created_at: dateXMinsAgo(3),
        user_id: 456,
        post_id: 789,
        user: {
          id: 456,
          username: 'joebloggs',
          twitter_username: 'twitter_username',
          profile_url: 'https://www.producthunt.com/joebloggs'
        }
      }
    ]

    const output = sut.prepareVotes(input)

    expect(output[0].activity.key).toBe('producthunt-vote-123')
    expect(output[0].activity.member.twitter).toBe('twitter_username')
    expect(output[0].identity.username).toBe('joebloggs')
  })
})

describe('OrbitProductHunt getCommentsPage', () => {
  let sut
  beforeEach(() => {
    sut = new OrbitProductHunt('1', '2', '3', '4')
  })

  it('given no comments, returns correctly', async () => {
    whenCommentPageReturns([])

    const response = await sut.getCommentsPage(123)

    expect(response.comments).toStrictEqual([])
    expect(response.children).toStrictEqual([])
  })

  it('given comments from api, returns values', async () => {
    whenCommentPageReturns([
      {
        id: 123,
        user_id: 456,
        subject_id: 789,
        child_comments: []
      }
    ])

    const response = await sut.getCommentsPage(123)

    expect(response.comments[0].id).toBe(123)
    expect(response.comments[0].user_id).toBe(456)
    expect(response.comments[0].subject_id).toBe(789)
  })

  it('given failure to get productHunt comments page, return underlying error', () => {
    sut.productHunt.comments.index = (id, callback) => {
      callback('This is an error', null)
    }

    expect(async () => {
      await sut.getCommentsPage(123)
    }).rejects.toMatch('This is an error')
  })

  function whenCommentPageReturns(returnedComments) {
    sut.productHunt.comments.index = (apiParams, callback) => {
      const stubbedResponse = {
        comments: returnedComments
      }
      const asString = JSON.stringify(stubbedResponse)
      const responseObject = { body: asString }

      callback(null, responseObject)
    }
  }
})

describe('OrbitProductHunt getComments', () => {
  let sut
  beforeEach(() => {
    sut = new OrbitProductHunt('1', '2', '3', '4')
  })

  it('single page of data, returns data from page', async () => {
    const queuedResponses = [
      { comments: [{ id: 1, user_id: 2, subject_id: 3 }], children: [] }
    ]

    sut.getCommentsPage = () => {
      return queuedResponses.shift()
    }

    const response = await sut.getComments(123)

    expect(response.length).toBe(1)
  })
  it('when there are multiple pages, returns all pages as one response', async () => {
    const queuedResponses = [
      { comments: [{ id: 1, user_id: 2, subject_id: 3 }], children: [] },
      { comments: [{ id: 4, user_id: 5, subject_id: 6 }], children: [] },
      { comments: [], children: [] }
    ]

    sut.getCommentsPage = () => {
      return queuedResponses.shift()
    }

    const response = await sut.getComments(123)

    expect(response.length).toBe(2)
  })
})

describe('OrbitProductHunt prepareComments', () => {
  let sut
  beforeEach(() => {
    sut = new OrbitProductHunt('1', '2', '3', '4')
  })

  it('given a null value, returns empty array', () => {
    const input = null
    const output = sut.prepareComments(input)
    expect(output.length).toBe(0)
  })

  it('given an empty array, returns empty array', () => {
    const input = []
    const output = sut.prepareComments(input)
    expect(output.length).toBe(0)
  })

  it('given only-new items, returns all items', () => {
    const input = [
      {
        id: 1,
        body: 'Comment text',
        created_at: dateXMinsAgo(3),
        user_id: 2,
        subject_id: 3,
        url: 'https://www.producthunt.com/posts/example',
        post_id: 4,
        user: {
          id: 5,
          username: 'joebloggs',
          twitter_username: 'joebloggs',
          profile_url: 'https://www.producthunt.com/example'
        },
        child_comments: []
      },
      {
        id: 1,
        body: 'Comment text',
        created_at: dateXMinsAgo(5),
        user_id: 2,
        subject_id: 3,
        url: 'https://www.producthunt.com/posts/example',
        post_id: 4,
        user: {
          id: 5,
          username: 'joebloggs',
          twitter_username: 'joebloggs',
          profile_url: 'https://www.producthunt.com/example'
        },
        child_comments: []
      }
    ]

    const output = sut.prepareVotes(input)
    expect(output.length).toBe(2)
  })

  it('given some old items, returns only new items', () => {
    const input = [
      {
        id: 1,
        body: 'Comment text',
        created_at: dateXMinsAgo(65),
        user_id: 2,
        subject_id: 3,
        url: 'https://www.producthunt.com/posts/example',
        post_id: 4,
        user: {
          id: 5,
          username: 'joebloggs',
          twitter_username: 'joebloggs',
          profile_url: 'https://www.producthunt.com/example'
        },
        child_comments: []
      },
      {
        id: 1,
        body: 'Comment text',
        created_at: dateXMinsAgo(5),
        user_id: 2,
        subject_id: 3,
        url: 'https://www.producthunt.com/posts/example',
        post_id: 4,
        user: {
          id: 5,
          username: 'joebloggs',
          twitter_username: 'joebloggs',
          profile_url: 'https://www.producthunt.com/example'
        },
        child_comments: []
      }
    ]

    const output = sut.prepareVotes(input)
    expect(output.length).toBe(1)
  })

  it('given array, new object structure is correct', () => {
    const input = [
      {
        id: 1,
        body: 'Comment text',
        created_at: dateXMinsAgo(5),
        user_id: 2,
        subject_id: 3,
        url: 'https://www.producthunt.com/posts/example',
        post_id: 4,
        user: {
          id: 5,
          username: 'joebloggs',
          twitter_username: 'twitter_username',
          profile_url: 'https://www.producthunt.com/example'
        },
        child_comments: []
      }
    ]

    const output = sut.prepareComments(input)

    expect(output[0].activity.key).toBe('producthunt-comment-1')
    expect(output[0].activity.member.twitter).toBe('twitter_username')
    expect(output[0].identity.username).toBe('joebloggs')
  })
})

describe('OrbitProductHunt addActivities', () => {
  let sut
  beforeEach(() => {
    sut = new OrbitProductHunt('1', '2', '3', '4')
    sut.orbit.createActivity = (activity) => {
      /* Noop */
    }
  })

  it('null provided, added stat is zero', async () => {
    const activities = null

    const result = await sut.addActivities(activities)

    expect(result.added).toBe(0)
  })

  it('no activity provided, added stat is zero', async () => {
    const activities = []

    const result = await sut.addActivities(activities)

    expect(result.added).toBe(0)
  })

  it('activity provided, added is incremented', async () => {
    const activities = [
      {
        /* Content irrelevant */
      }
    ]

    const result = await sut.addActivities(activities)

    expect(result.added).toBe(1)
  })

  it('activity provided, error is thrown with a key, duplicate count incremented', async () => {
    sut.orbit.createActivity = (activity) => {
      throw {
        errors: {
          key: '123'
        }
      }
    }

    const result = await sut.addActivities([
      {
        /* Content irrelevant */
      }
    ])

    expect(result.duplicates).toBe(1)
  })

  it('activity provided, error is thrown with no key, error is captured', async () => {
    sut.orbit.createActivity = (activity) => {
      throw {
        errors: {
          noKeyHere: 'sorry'
        }
      }
    }

    const result = await sut.addActivities([
      {
        /* Content irrelevant */
      }
    ])

    expect(result.errors.length).toBe(1)
  })
})

function dateXMinsAgo(mins) {
  const date = new Date()
  date.setMinutes(date.getMinutes() - mins)
  return date
}
