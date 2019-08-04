const aws = require('aws-sdk');
const AdmZip = require('adm-zip');

const codepipeline = new aws.CodePipeline({apiVersion: '2015-07-09'});
const bucketDest = 'accountsapp-build.cg-palevasseur'; // public bucket to deploy index.html & sources

exports.handler = async function(event, context) {
  const job = event["CodePipeline.job"];
  const jobId = job ? job.id : undefined;
  const buildZip = job ? job.data.inputArtifacts[0].location.s3Location.objectKey : 'accountsapp.zip'; // default value for test
  const bucketSrc = job ? job.data.inputArtifacts[0].location.s3Location.bucketName : bucketDest; // default value same as dest for test
  console.log('bucket src=' + bucketSrc + ', build zip=' + buildZip + ', bucket dest=' + bucketDest);

  try {
    // get zip file
    const s3 = new aws.S3({ apiVersion: '2006-03-01' });
    const inputFile = await s3.getObject({
      Bucket: bucketSrc,
      Key: buildZip,
    }).promise();

    // unzip content in the same
    const inputZip = new AdmZip(inputFile.Body);
    const entries = inputZip.getEntries();
    let bucketsList = [];
    entries.forEach((entry) => {
      const params = {
        Bucket: bucketDest,
        Key: entry.entryName,
        Body: entry.getData(),
        ContentType: 'content-type'
      };
      console.log('Creating file "' + entry.entryName + '" with params=', params);
      bucketsList.push(s3.putObject(params).promise());
    });

    // wait all promise before end
    await Promise.all(bucketsList);

    if(jobId) {
      // propagate pipeline result
      await codepipeline.putJobSuccessResult({jobId}).promise();
    }
  }
  catch (err) {
    console.log(err);
    const message = `Error getting object ${buildZip} from bucket ${bucketSrc}. Make sure they exist and your bucket is in the same region as this function.`;
    console.log(message);

    const params = {
      jobId,
      failureDetails: {
        message: err.toString(),
        type: 'JobFailed',
        externalExecutionId: context.invokeid
      }
    };
    await codepipeline.putJobFailureResult(params).promise();
  }
};